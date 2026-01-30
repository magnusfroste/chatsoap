import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "./useNotifications";
import { useRingtone } from "./useRingtone";

export interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string | null;
  callType: "audio" | "video";
  conversationId: string;
}

export function useIncomingCallListener(userId: string | undefined) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const { showCallNotification } = useNotifications();
  const { startRingtone, stopRingtone } = useRingtone();
  const activeNotificationRef = useRef<Notification | null>(null);

  // Close any active notification and stop ringtone
  const closeActiveNotification = useCallback(() => {
    stopRingtone();
    if (activeNotificationRef.current) {
      activeNotificationRef.current.close();
      activeNotificationRef.current = null;
    }
  }, [stopRingtone]);

  // Accept call - navigate to chat
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return null;
    
    closeActiveNotification();
    
    console.log('[IncomingCallListener] Accepting call:', incomingCall.callId);
    
    // Update call status to accepted - MUST complete before navigation
    const { error } = await supabase
      .from("direct_calls")
      .update({ status: "accepted", started_at: new Date().toISOString() })
      .eq("id", incomingCall.callId);

    if (error) {
      console.error('[IncomingCallListener] Failed to accept call:', error);
      // Still try to continue - the caller might timeout
    } else {
      console.log('[IncomingCallListener] ✅ Call accepted successfully in database');
    }

    const conversationId = incomingCall.conversationId;
    setIncomingCall(null);
    return conversationId;
  }, [incomingCall, closeActiveNotification]);

  // Decline call
  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    closeActiveNotification();

    await supabase
      .from("direct_calls")
      .update({ status: "declined", ended_at: new Date().toISOString() })
      .eq("id", incomingCall.callId);

    setIncomingCall(null);
  }, [incomingCall, closeActiveNotification]);

  // Listen for incoming calls globally
  useEffect(() => {
    if (!userId) return;

    // Use unique channel names to avoid binding conflicts
    const channelName = `global-incoming-calls-${userId}-${Date.now()}`;
    const statusChannelName = `global-call-status-${userId}-${Date.now()}`;

    console.log('[IncomingCallListener] Setting up channel:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_calls",
        },
        async (payload) => {
          const call = payload.new as any;
          
          // Client-side filter to avoid binding mismatch
          if (call.callee_id !== userId) return;
          if (call.status !== "ringing") return;

          console.log('[IncomingCallListener] Incoming call detected:', call.id);

          // Fetch caller info
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", call.caller_id)
            .single();

          const callerName = profile?.display_name || null;

          // Show push notification for incoming call (works when app is in background)
          const notification = showCallNotification(
            callerName || "Unknown",
            call.call_type as "audio" | "video",
            call.conversation_id
          );
          if (notification) {
            activeNotificationRef.current = notification;
          }

          // Start ringtone immediately when call is detected
          startRingtone();

          setIncomingCall({
            callId: call.id,
            callerId: call.caller_id,
            callerName,
            callType: call.call_type,
            conversationId: call.conversation_id,
          });
        }
      )
      .subscribe((status, err) => {
        console.log('[IncomingCallListener] Subscription status:', status, err ? `Error: ${err}` : '');
      });

    // Also listen for call status changes to dismiss if caller cancels or callee answers elsewhere
    const statusChannel = supabase
      .channel(statusChannelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_calls",
        },
        (payload) => {
          const call = payload.new as any;
          
          // Client-side filter
          if (call.callee_id !== userId) return;
          
          // Stop ringing for any status change that ends the ringing state
          if (call.status === "ended" || call.status === "declined" || call.status === "accepted") {
            console.log('[IncomingCallListener] Call status changed to:', call.status, '- stopping ringtone');
            closeActiveNotification();
            setIncomingCall((current) => 
              current?.callId === call.id ? null : current
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(statusChannel);
    };
  }, [userId]);

  return {
    incomingCall,
    acceptCall,
    declineCall,
  };
}
