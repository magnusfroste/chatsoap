import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string | null;
  callType: "audio" | "video";
  conversationId: string;
}

export function useIncomingCallListener(userId: string | undefined) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  // Accept call - navigate to chat
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return null;
    
    // Update call status to accepted
    await supabase
      .from("direct_calls")
      .update({ status: "accepted", started_at: new Date().toISOString() })
      .eq("id", incomingCall.callId);

    const conversationId = incomingCall.conversationId;
    setIncomingCall(null);
    return conversationId;
  }, [incomingCall]);

  // Decline call
  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    await supabase
      .from("direct_calls")
      .update({ status: "declined", ended_at: new Date().toISOString() })
      .eq("id", incomingCall.callId);

    setIncomingCall(null);
  }, [incomingCall]);

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

          setIncomingCall({
            callId: call.id,
            callerId: call.caller_id,
            callerName: profile?.display_name || null,
            callType: call.call_type,
            conversationId: call.conversation_id,
          });
        }
      )
      .subscribe((status, err) => {
        console.log('[IncomingCallListener] Subscription status:', status, err ? `Error: ${err}` : '');
      });

    // Also listen for call status changes to dismiss if caller cancels
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
          
          if (call.status === "ended" || call.status === "declined") {
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
