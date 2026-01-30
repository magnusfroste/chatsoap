import { useState, useEffect, useRef } from "react";

/**
 * Hook to analyze audio levels from a MediaStream
 * Returns a normalized level value between 0 and 1
 */
export function useAudioLevel(stream: MediaStream | null, enabled: boolean = true) {
  const [level, setLevel] = useState(0);
  const animationFrameRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const contextRef = useRef<AudioContext>();
  const sourceRef = useRef<MediaStreamAudioSourceNode>();

  useEffect(() => {
    if (!stream || !enabled) {
      setLevel(0);
      return;
    }

    // Check if stream has audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.log("[useAudioLevel] No audio tracks in stream");
      return;
    }

    console.log("[useAudioLevel] Setting up audio analysis for stream with tracks:", 
      audioTracks.map(t => `${t.label}:${t.enabled}`));

    let cleanup: (() => void) | undefined;

    const setupAnalyser = async () => {
      try {
        // Create audio context and analyser
        const audioContext = new AudioContext();
        
        // Resume context if suspended (Chrome autoplay policy)
        if (audioContext.state === "suspended") {
          await audioContext.resume();
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
          if (!analyserRef.current) return;

          // Get time domain data (waveform) - better for voice
          analyserRef.current.getByteTimeDomainData(dataArray);

          // Calculate RMS (root mean square) for accurate volume
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            // Convert from 0-255 to -1 to 1
            const normalized = (dataArray[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          
          // Scale RMS to 0-1 with sensitivity boost for voice
          // RMS of normal speech is typically 0.1-0.3
          const normalizedLevel = Math.min(1, rms * 4);
          setLevel(normalizedLevel);

          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();

        cleanup = () => {
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          if (sourceRef.current) {
            sourceRef.current.disconnect();
          }
          if (contextRef.current && contextRef.current.state !== "closed") {
            contextRef.current.close();
          }
        };
      } catch (error) {
        console.error("[useAudioLevel] Error setting up audio analysis:", error);
      }
    };

    setupAnalyser();

    return () => {
      if (cleanup) cleanup();
    };
  }, [stream, enabled]);

  return level;
}
