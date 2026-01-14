import { useEffect, useRef, useCallback } from "react";

export const useRingtone = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);

  // Check if vibration is supported
  const supportsVibration = "vibrate" in navigator;

  // Trigger vibration pattern
  const vibrate = useCallback(() => {
    if (supportsVibration) {
      try {
        // Vibration pattern: vibrate 200ms, pause 100ms, vibrate 200ms
        navigator.vibrate([200, 100, 200, 100, 200]);
      } catch (error) {
        console.error("Vibration error:", error);
      }
    }
  }, [supportsVibration]);

  // Stop vibration
  const stopVibration = useCallback(() => {
    if (supportsVibration) {
      try {
        navigator.vibrate(0);
      } catch (error) {
        console.error("Stop vibration error:", error);
      }
    }
  }, [supportsVibration]);

  // Play a single ring tone
  const playRingTone = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    // Create a pleasant ring pattern (two-tone ring like a phone)
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = "sine";

      // Envelope for smooth sound
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gainNode.gain.setValueAtTime(0.3, startTime + duration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // Classic phone ring pattern: two tones alternating
    playTone(440, now, 0.15); // A4
    playTone(480, now + 0.15, 0.15); // B4
    playTone(440, now + 0.3, 0.15);
    playTone(480, now + 0.45, 0.15);
  }, []);

  // Start looping ringtone with vibration
  const startRingtone = useCallback(() => {
    if (isPlayingRef.current) return;
    
    isPlayingRef.current = true;
    
    // Play immediately
    playRingTone();
    vibrate();
    
    // Then repeat every 2 seconds (ring pattern with pause)
    intervalRef.current = window.setInterval(() => {
      if (isPlayingRef.current) {
        playRingTone();
        vibrate();
      }
    }, 2000);
  }, [playRingTone, vibrate]);

  // Stop ringtone and vibration
  const stopRingtone = useCallback(() => {
    isPlayingRef.current = false;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    stopVibration();
  }, [stopVibration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRingtone();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopRingtone]);

  return {
    startRingtone,
    stopRingtone,
  };
};
