import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface TypingUser {
  id: string;
  display_name: string;
}

interface PresenceState {
  user_id: string;
  display_name: string;
  is_typing: boolean;
}

export const useTypingPresence = (
  conversationId: string | undefined,
  userId: string | undefined,
  displayName: string | undefined
) => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceState>();
        const typing: TypingUser[] = [];

        Object.entries(state).forEach(([key, presences]) => {
          if (key !== userId) {
            const presence = presences[0];
            if (presence?.is_typing) {
              typing.push({
                id: key,
                display_name: presence.display_name || "Någon",
              });
            }
          }
        });

        setTypingUsers(typing);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (key !== userId) {
          const presence = newPresences[0] as unknown as PresenceState;
          if (presence?.is_typing) {
            setTypingUsers((prev) => {
              if (prev.find((u) => u.id === key)) return prev;
              return [...prev, { id: key, display_name: presence.display_name || "Någon" }];
            });
          }
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        if (key !== userId) {
          setTypingUsers((prev) => prev.filter((u) => u.id !== key));
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            display_name: displayName || "User",
            is_typing: false,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, displayName]);

  const startTyping = useCallback(async () => {
    if (!channelRef.current || !userId || isTypingRef.current) return;

    isTypingRef.current = true;
    await channelRef.current.track({
      user_id: userId,
      display_name: displayName || "User",
      is_typing: true,
    });

    // Auto-stop typing after 3 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [userId, displayName]);

  const stopTyping = useCallback(async () => {
    if (!channelRef.current || !userId) return;

    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    await channelRef.current.track({
      user_id: userId,
      display_name: displayName || "User",
      is_typing: false,
    });
  }, [userId, displayName]);

  const handleInputChange = useCallback(() => {
    startTyping();
  }, [startTyping]);

  return {
    typingUsers,
    handleInputChange,
    stopTyping,
  };
};
