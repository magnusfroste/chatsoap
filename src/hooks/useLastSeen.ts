import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL = 60_000; // 1 minute

/**
 * Sends a heartbeat to update the user's last_seen_at in profiles.
 * Should be mounted once at the app level (e.g. in AuthProvider).
 */
export function useLastSeenHeartbeat(userId: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendHeartbeat = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Send immediately on mount
    sendHeartbeat();

    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Also send on visibility change (tab focus)
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, sendHeartbeat]);
}

/**
 * Format a last_seen_at timestamp into a human-readable string.
 */
export function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "offline";

  const now = Date.now();
  const seen = new Date(lastSeenAt).getTime();
  const diffMs = now - seen;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 2) return "online";
  if (diffMin < 60) return `active ${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `active ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "active yesterday";
  return `active ${diffDays}d ago`;
}
