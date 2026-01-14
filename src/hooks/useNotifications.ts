import { useState, useEffect, useCallback } from "react";
import { useNotificationSettings } from "./useNotificationSettings";

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
  onClick?: () => void;
}

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const { triggerNotificationEffect } = useNotificationSettings();

  useEffect(() => {
    // Check if notifications are supported
    const supported = "Notification" in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn("Notifications are not supported in this browser");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback(
    ({ title, body, icon, tag, data, onClick }: NotificationOptions) => {
      if (!isSupported || permission !== "granted") {
        return null;
      }

      // Don't show notification if document is visible/focused
      if (document.visibilityState === "visible" && document.hasFocus()) {
        return null;
      }

      try {
        const notification = new Notification(title, {
          body,
          icon: icon || "/favicon.ico",
          tag, // Prevents duplicate notifications with same tag
          badge: "/favicon.ico",
          data,
          requireInteraction: false,
          silent: false,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          onClick?.();
        };

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        return notification;
      } catch (error) {
        console.error("Error showing notification:", error);
        return null;
      }
    },
    [isSupported, permission]
  );

  const showMessageNotification = useCallback(
    (senderName: string, messageContent: string, conversationId: string, isGroup: boolean = false) => {
      // Truncate message if too long
      const truncatedMessage = messageContent.length > 100 
        ? messageContent.slice(0, 100) + "..." 
        : messageContent;

      // Trigger sound and vibration effects
      triggerNotificationEffect();

      return showNotification({
        title: isGroup ? `Nytt meddelande i ${senderName}` : senderName,
        body: truncatedMessage,
        tag: `message-${conversationId}`, // Group notifications by conversation
        data: { conversationId, isGroup },
        onClick: () => {
          // Navigate to conversation
          const path = isGroup ? `/group/${conversationId}` : `/chat/${conversationId}`;
          window.location.href = path;
        },
      });
    },
    [showNotification, triggerNotificationEffect]
  );

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    showMessageNotification,
  };
};
