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
  const createPeer = useCallback((initiator: boolean, stream: MediaStream, targetUserId: string) => {
    console.log(`Creating peer, initiator: ${initiator}`);
    
    const peer = new Peer({
      initiator,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    peer.on("signal", async (signal: SignalData) => {
      if (!callIdRef.current) return;
      console.log("Sending call signal");
      await supabase.from("call_signals").insert({
        call_id: callIdRef.current,
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
      endCall();
    });

    peer.on("close", () => {
      console.log("Peer connection closed");
    });

    peerRef.current = peer;
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

    // Create peer as initiator
    createPeer(true, stream, otherUserId);
  }, [conversationId, userId, otherUserId, otherUserName, getLocalMedia, stopLocalMedia, createPeer]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!callState.callId || !callState.remoteUserId) return;

    const stream = await getLocalMedia(callState.callType === "video");
    if (!stream) return;

    // Update call status
    await supabase
      .from("direct_calls")
      .update({ status: "accepted", started_at: new Date().toISOString() })
      .eq("id", callState.callId);

    setCallState((prev) => ({ ...prev, status: "connected" }));

    // Create peer as non-initiator
    createPeer(false, stream, callState.remoteUserId);
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

  // Listen for incoming calls
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`incoming-calls-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_calls",
          filter: `callee_id=eq.${userId}`,
        },
        async (payload) => {
          const call = payload.new as any;
          if (call.status !== "ringing") return;

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Listen for call status changes
  useEffect(() => {
    if (!callState.callId) return;

    const channel = supabase
      .channel(`call-${callState.callId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_calls",
          filter: `id=eq.${callState.callId}`,
        },
        (payload) => {
          const call = payload.new as any;
          
          if (call.status === "accepted" && callState.status === "calling") {
            setCallState((prev) => ({ ...prev, status: "connected" }));
          } else if (call.status === "declined" || call.status === "ended") {
            endCall();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callState.callId, callState.status, endCall]);

  // Listen for signals
  useEffect(() => {
    if (!callState.callId || !userId) return;

    const channel = supabase
      .channel(`call-signals-${callState.callId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `to_user_id=eq.${userId}`,
        },
        async (payload) => {
          const signal = payload.new as any;
          if (signal.call_id !== callState.callId) return;

          console.log("Received signal");
          
          if (peerRef.current) {
            peerRef.current.signal(signal.signal_data);
          }

          // Clean up signal
          await supabase.from("call_signals").delete().eq("id", signal.id);
        }
      )
      .subscribe();

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
