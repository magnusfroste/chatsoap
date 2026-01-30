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

    try {
      // Create audio context and analyser
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      // Connect stream to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      contextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Normalize to 0-1 range with some sensitivity adjustment
        const normalizedLevel = Math.min(1, average / 128);
        setLevel(normalizedLevel);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        source.disconnect();
        audioContext.close();
      };
    } catch (error) {
      console.error("[useAudioLevel] Error setting up audio analysis:", error);
    }
  }, [stream, enabled]);

  return level;
}
