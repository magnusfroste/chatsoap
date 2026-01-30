import { useState, useEffect, useRef, useCallback } from "react";
import Peer, { Instance as PeerInstance, SignalData } from "simple-peer";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";
export type CallType = "audio" | "video";

interface CallState {
  callId: string | null;
  status: CallStatus;
  callType: CallType;
  remoteUserId: string | null;
  remoteUserName: string | null;
  isIncoming: boolean;
}

export function useDirectCall(
  conversationId: string | undefined,
  userId: string | undefined,
  otherUserId: string | undefined,
  otherUserName: string | undefined
) {
  const [callState, setCallState] = useState<CallState>({
    callId: null,
    status: "idle",
    callType: "audio",
    remoteUserId: null,
    remoteUserName: null,
    isIncoming: false,
  });
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const peerRef = useRef<PeerInstance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);

  // Get local media
  const getLocalMedia = useCallback(async (video: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video ? { width: 640, height: 480, facingMode: "user" } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setVideoEnabled(video);
      setAudioEnabled(true);
      return stream;
    } catch (error) {
      console.error("Error getting media:", error);
      return null;
    }
  }, []);

  // Stop local media
  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  // Create peer connection
  const createPeer = useCallback(async (initiator: boolean, stream: MediaStream, targetUserId: string, callId: string) => {
    console.log(`Creating peer, initiator: ${initiator}, callId: ${callId}`);
    
    const peer = new Peer({
      initiator,
      trickle: true, // Enable trickle for faster connection
      stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
        ],
      },
    });

    peer.on("signal", async (signal: SignalData) => {
      console.log("Sending call signal, type:", (signal as any).type || "candidate");
      await supabase.from("call_signals").insert({
        call_id: callId,
        from_user_id: userId!,
        to_user_id: targetUserId,
        signal_data: signal as unknown as Json,
      });
    });

    peer.on("stream", (stream: MediaStream) => {
      console.log("Received remote stream");
      setRemoteStream(stream);
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      // Clean up on error - do inline to avoid circular dependency
      peer.destroy();
      peerRef.current = null;
    });

    peer.on("close", () => {
      console.log("Peer connection closed");
    });

    peer.on("connect", () => {
      console.log("Peer connected!");
    });

    peerRef.current = peer;

    // For non-initiator: fetch any existing signals that were sent before we created the peer
    if (!initiator) {
      console.log("Fetching existing signals for call:", callId);
      const { data: existingSignals } = await supabase
        .from("call_signals")
        .select("*")
        .eq("call_id", callId)
        .eq("to_user_id", userId!)
        .order("created_at", { ascending: true });

      if (existingSignals && existingSignals.length > 0) {
        console.log(`Found ${existingSignals.length} existing signals`);
        for (const signal of existingSignals) {
          console.log("Processing existing signal");
          peer.signal(signal.signal_data as any);
          // Delete after processing
          await supabase.from("call_signals").delete().eq("id", signal.id);
        }
      }
    }

    return peer;
  }, [userId]);

  // Initiate a call
  const startCall = useCallback(async (type: CallType) => {
    if (!conversationId || !userId || !otherUserId) return;

    const stream = await getLocalMedia(type === "video");
    if (!stream) return;

    // Create call record
    const { data: call, error } = await supabase
      .from("direct_calls")
      .insert({
        conversation_id: conversationId,
        caller_id: userId,
        callee_id: otherUserId,
        call_type: type,
        status: "ringing",
      })
      .select()
      .single();

    if (error || !call) {
      console.error("Error creating call:", error);
      stopLocalMedia();
      return;
    }

    callIdRef.current = call.id;
    setCallState({
      callId: call.id,
      status: "calling",
      callType: type,
      remoteUserId: otherUserId,
      remoteUserName: otherUserName || null,
      isIncoming: false,
    });

    // Create peer as initiator - pass the callId
    createPeer(true, stream, otherUserId, call.id);
  }, [conversationId, userId, otherUserId, otherUserName, getLocalMedia, stopLocalMedia, createPeer]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!callState.callId || !callState.remoteUserId) return;

    const stream = await getLocalMedia(callState.callType === "video");
    if (!stream) return;

    setCallState((prev) => ({ ...prev, status: "connected" }));

    // Create peer as non-initiator FIRST (this will also fetch existing signals)
    await createPeer(false, stream, callState.remoteUserId, callState.callId);

    // Update call status AFTER peer is ready
    await supabase
      .from("direct_calls")
      .update({ status: "accepted", started_at: new Date().toISOString() })
      .eq("id", callState.callId);
  }, [callState.callId, callState.remoteUserId, callState.callType, getLocalMedia, createPeer]);

  // Decline incoming call
  const declineCall = useCallback(async () => {
    if (!callState.callId) return;

    await supabase
      .from("direct_calls")
      .update({ status: "declined", ended_at: new Date().toISOString() })
      .eq("id", callState.callId);

    setCallState({
      callId: null,
      status: "idle",
      callType: "audio",
      remoteUserId: null,
      remoteUserName: null,
      isIncoming: false,
    });
  }, [callState.callId]);

  // End call
  const endCall = useCallback(async () => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    stopLocalMedia();
    setRemoteStream(null);

    if (callIdRef.current) {
      await supabase
        .from("direct_calls")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", callIdRef.current);
      
      // Clean up signals
      await supabase
        .from("call_signals")
        .delete()
        .eq("call_id", callIdRef.current);
    }

    callIdRef.current = null;
    setCallState({
      callId: null,
      status: "idle",
      callType: "audio",
      remoteUserId: null,
      remoteUserName: null,
      isIncoming: false,
    });
  }, [stopLocalMedia]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      } else {
        // Add video track
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newVideoTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newVideoTrack);
          
          // Add track to peer connection
          if (peerRef.current) {
            (peerRef.current as any).addTrack(newVideoTrack, localStreamRef.current);
          }
          
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
          setVideoEnabled(true);
        } catch (error) {
          console.error("Error adding video:", error);
        }
      }
    }
  }, []);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing && screenStreamRef.current) {
      // Stop screen sharing
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);
      
      // Replace screen track with video track
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack && peerRef.current) {
        const sender = (peerRef.current as any)._pc?.getSenders?.()?.find(
          (s: RTCRtpSender) => s.track?.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as any,
          audio: false,
        });
        
        screenStreamRef.current = stream;
        setScreenStream(stream);
        setIsScreenSharing(true);
        
        const screenTrack = stream.getVideoTracks()[0];
        
        // Replace video track with screen track
        if (peerRef.current) {
          const sender = (peerRef.current as any)._pc?.getSenders?.()?.find(
            (s: RTCRtpSender) => s.track?.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        }
        
        // Handle when user stops sharing via browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (error) {
        console.error("Error starting screen share:", error);
      }
    }
  }, [isScreenSharing]);

  // Check for active calls when mounting (handles case where user accepts via global overlay)
  useEffect(() => {
    if (!conversationId || !userId) return;

    let cancelled = false;

    const checkActiveCall = async () => {
      // Look for an accepted call where this user is the callee and peer isn't created yet
      const { data: activeCall } = await supabase
        .from("direct_calls")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("callee_id", userId)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (cancelled) return;

      // Use ref to check current call state without triggering re-renders
      if (activeCall && !peerRef.current && !callIdRef.current) {
        console.log('[DirectCall] Found active accepted call, joining:', activeCall.id);
        
        // Fetch caller info
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", activeCall.caller_id)
          .single();

        if (cancelled) return;

        callIdRef.current = activeCall.id;
        setCallState({
          callId: activeCall.id,
          status: "connected",
          callType: activeCall.call_type as CallType,
          remoteUserId: activeCall.caller_id,
          remoteUserName: profile?.display_name || null,
          isIncoming: true,
        });

        // Get local media and create peer
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: activeCall.call_type === "video" ? { width: 640, height: 480, facingMode: "user" } : false,
          });
          
          if (cancelled) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          localStreamRef.current = stream;
          setLocalStream(stream);
          setVideoEnabled(activeCall.call_type === "video");
          setAudioEnabled(true);

          // Create peer as non-initiator
          const peer = new Peer({
            initiator: false,
            trickle: true,
            stream,
            config: {
              iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
              ],
            },
          });

          peer.on("signal", async (signal) => {
            await supabase.from("call_signals").insert({
              call_id: activeCall.id,
              from_user_id: userId,
              to_user_id: activeCall.caller_id,
              signal_data: signal as unknown as Json,
            });
          });

          peer.on("stream", (remoteStream) => {
            setRemoteStream(remoteStream);
          });

          peer.on("error", (err) => {
            console.error("Peer error:", err);
            peer.destroy();
            peerRef.current = null;
          });

          peer.on("connect", () => {
            console.log("Peer connected!");
          });

          peerRef.current = peer;

          // Fetch existing signals
          const { data: existingSignals } = await supabase
            .from("call_signals")
            .select("*")
            .eq("call_id", activeCall.id)
            .eq("to_user_id", userId)
            .order("created_at", { ascending: true });

          if (existingSignals && existingSignals.length > 0) {
            for (const signal of existingSignals) {
              peer.signal(signal.signal_data as any);
              await supabase.from("call_signals").delete().eq("id", signal.id);
            }
          }
        } catch (error) {
          console.error("Error joining call:", error);
        }
      }
    };

    // Small delay to ensure component is mounted
    const timer = setTimeout(checkActiveCall, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [conversationId, userId]);

  // Listen for incoming calls
  useEffect(() => {
    if (!userId) return;

    // Use unique channel name to avoid binding conflicts
    const channelName = `incoming-calls-${userId}-${Date.now()}`;
    console.log('[DirectCall] Setting up incoming calls channel:', channelName);

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

          console.log('[DirectCall] Incoming call detected:', call.id);

          // Fetch caller info
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", call.caller_id)
            .single();

          callIdRef.current = call.id;
          setCallState({
            callId: call.id,
            status: "ringing",
            callType: call.call_type,
            remoteUserId: call.caller_id,
            remoteUserName: profile?.display_name || null,
            isIncoming: true,
          });
        }
      )
      .subscribe((status, err) => {
        console.log('[DirectCall] Incoming calls subscription status:', status, err ? `Error: ${err}` : '');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Listen for call status changes
  useEffect(() => {
    if (!callState.callId) return;

    const channelName = `call-status-${callState.callId}-${Date.now()}`;
    console.log('[DirectCall] Setting up call status channel:', channelName);

    const channel = supabase
      .channel(channelName)
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
          if (call.id !== callState.callId) return;
          
          console.log('[DirectCall] Call status update:', call.status);
          
          if (call.status === "accepted" && callState.status === "calling") {
            setCallState((prev) => ({ ...prev, status: "connected" }));
          } else if (call.status === "declined" || call.status === "ended") {
            endCall();
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[DirectCall] Call status subscription:', status, err ? `Error: ${err}` : '');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callState.callId, callState.status, endCall]);

  // Listen for signals
  useEffect(() => {
    if (!callState.callId || !userId) return;

    const channelName = `call-signals-${callState.callId}-${Date.now()}`;
    console.log('[DirectCall] Setting up signal listener:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
        },
        async (payload) => {
          const signal = payload.new as any;
          
          // Client-side filter
          if (signal.to_user_id !== userId) return;
          if (signal.call_id !== callState.callId) return;

          console.log('[DirectCall] Received signal, type:', (signal.signal_data as any)?.type || "candidate");
          
          if (peerRef.current) {
            try {
              peerRef.current.signal(signal.signal_data);
              console.log('[DirectCall] Signal processed successfully');
            } catch (err) {
              console.error('[DirectCall] Error processing signal:', err);
            }
          } else {
            console.warn('[DirectCall] Peer not ready yet, signal might be lost');
          }

          // Clean up signal after small delay to ensure it's processed
          setTimeout(async () => {
            await supabase.from("call_signals").delete().eq("id", signal.id);
          }, 500);
        }
      )
      .subscribe((status, err) => {
        console.log('[DirectCall] Signal subscription status:', status, err ? `Error: ${err}` : '');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callState.callId, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    callState,
    localStream,
    remoteStream,
    screenStream,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  };
}
