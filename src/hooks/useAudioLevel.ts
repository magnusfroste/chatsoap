import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Hook to analyze audio levels from a MediaStream
 * Returns a normalized level value between 0 and 1
 */
export function useAudioLevel(stream: MediaStream | null, enabled: boolean = true) {
  const [level, setLevel] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isCleanedUpRef = useRef(false);

  useEffect(() => {
    // Reset cleanup flag
    isCleanedUpRef.current = false;

    if (!stream || !enabled) {
      setLevel(0);
      return;
    }

    // Check if stream has audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      return;
    }

    const setupAnalyser = async () => {
      // Check if already cleaned up before async operation completes
      if (isCleanedUpRef.current) return;

      try {
        // Create audio context and analyser
        const audioContext = new AudioContext();
        
        // Resume context if suspended (Chrome autoplay policy)
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        // Check again after await
        if (isCleanedUpRef.current) {
          audioContext.close();
          return;
        }

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.3;

        // Connect stream to analyser
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        contextRef.current = audioContext;
        analyserRef.current = analyser;
        sourceRef.current = source;

        // Use time domain data for better voice detection
        const dataArray = new Uint8Array(analyser.fftSize);

        const updateLevel = () => {
          if (isCleanedUpRef.current || !analyserRef.current) return;

          // Get time domain data (waveform) - better for voice
          analyserRef.current.getByteTimeDomainData(dataArray);

          // Calculate RMS (root mean square) for accurate volume
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          
          // Scale RMS to 0-1 with sensitivity boost for voice
          const normalizedLevel = Math.min(1, rms * 4);
          setLevel(normalizedLevel);

          if (!isCleanedUpRef.current) {
            animationFrameRef.current = requestAnimationFrame(updateLevel);
          }
        };

        updateLevel();
      } catch (error) {
        console.error("[useAudioLevel] Error setting up audio analysis:", error);
      }
    };

    setupAnalyser();

    return () => {
      isCleanedUpRef.current = true;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (e) {}
        sourceRef.current = null;
      }
      if (contextRef.current && contextRef.current.state !== "closed") {
        try {
          contextRef.current.close();
        } catch (e) {}
        contextRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [stream, enabled]);

  return level;
}
