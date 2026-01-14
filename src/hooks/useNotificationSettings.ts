import { useState, useEffect, useCallback } from "react";

export interface NotificationSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  soundVolume: number; // 0-1
}

const STORAGE_KEY = "notification_settings";

const defaultSettings: NotificationSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  soundVolume: 0.5,
};

export const useNotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    }
  }, []);

  // Save settings to localStorage whenever they change
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Error saving notification settings:", error);
      }
      return updated;
    });
  }, []);

  const toggleSound = useCallback(() => {
    updateSettings({ soundEnabled: !settings.soundEnabled });
  }, [settings.soundEnabled, updateSettings]);

  const toggleVibration = useCallback(() => {
    updateSettings({ vibrationEnabled: !settings.vibrationEnabled });
  }, [settings.vibrationEnabled, updateSettings]);

  const setVolume = useCallback((volume: number) => {
    updateSettings({ soundVolume: Math.max(0, Math.min(1, volume)) });
  }, [updateSettings]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!settings.soundEnabled) return;

    try {
      // Create a simple notification beep using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(settings.soundVolume * 0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error("Error playing notification sound:", error);
    }
  }, [settings.soundEnabled, settings.soundVolume]);

  // Trigger vibration
  const triggerVibration = useCallback(() => {
    if (!settings.vibrationEnabled) return;

    try {
      if ("vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]); // Short vibration pattern
      }
    } catch (error) {
      console.error("Error triggering vibration:", error);
    }
  }, [settings.vibrationEnabled]);

  // Combined notification effect (sound + vibration)
  const triggerNotificationEffect = useCallback(() => {
    playNotificationSound();
    triggerVibration();
  }, [playNotificationSound, triggerVibration]);

  return {
    settings,
    updateSettings,
    toggleSound,
    toggleVibration,
    setVolume,
    playNotificationSound,
    triggerVibration,
    triggerNotificationEffect,
  };
};
