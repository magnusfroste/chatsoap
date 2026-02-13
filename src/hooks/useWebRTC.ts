import { useState, useEffect, useRef, useCallback } from "react";
import Peer, { Instance as PeerInstance, SignalData } from "simple-peer";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

interface PeerConnection {
  peerId: string;
  peer: PeerInstance;
  stream?: MediaStream;
}

interface Participant {
  id: string;
  user_id: string;
  video_enabled: boolean;
  audio_enabled: boolean;
  display_name?: string;
  stream?: MediaStream;
}

export function useWebRTC(roomId: string | undefined, userId: string | undefined) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Get local media stream
  const startLocalStream = useCallback(async (video: boolean, audio: boolean) => {
    try {
      setIsConnecting(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 320, height: 240, facingMode: "user" } : false,
        audio: audio,
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      setVideoEnabled(video);
      setAudioEnabled(audio);
      
      return stream;
    } catch (error) {
      console.error("Error getting media devices:", error);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Stop local stream
  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    setVideoEnabled(false);
    setAudioEnabled(false);
  }, []);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) {
      await startLocalStream(true, audioEnabled);
      return;
    }
    
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setVideoEnabled(videoTrack.enabled);
      
      // Update presence
      if (roomId && userId) {
        await supabase.from("room_presence").upsert({
          room_id: roomId,
          user_id: userId,
          video_enabled: videoTrack.enabled,
          audio_enabled: audioEnabled,
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      // No video track, need to get one
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const newVideoTrack = stream.getVideoTracks()[0];
      localStreamRef.current.addTrack(newVideoTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setVideoEnabled(true);
    }
  }, [audioEnabled, roomId, userId, startLocalStream]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!localStreamRef.current) {
      await startLocalStream(videoEnabled, true);
      return;
    }
    
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setAudioEnabled(audioTrack.enabled);
      
      // Update presence
      if (roomId && userId) {
        await supabase.from("room_presence").upsert({
          room_id: roomId,
          user_id: userId,
          video_enabled: videoEnabled,
          audio_enabled: audioTrack.enabled,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }, [videoEnabled, roomId, userId, startLocalStream]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing && screenStreamRef.current) {
      // Stop screen sharing
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);
      
      // Replace screen track with video track in all peers
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        peersRef.current.forEach(({ peer }) => {
          const sender = (peer as any)._pc?.getSenders?.()?.find(
            (s: RTCRtpSender) => s.track?.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
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
        
        // Replace video track with screen track in all peers
        peersRef.current.forEach(({ peer }) => {
          const sender = (peer as any)._pc?.getSenders?.()?.find(
            (s: RTCRtpSender) => s.track?.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });
        
        // Handle when user stops sharing via browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (error) {
        console.error("Error starting screen share:", error);
      }
    }
  }, [isScreenSharing]);

  // Create peer connection
  const createPeer = useCallback((targetUserId: string, initiator: boolean, stream: MediaStream) => {
    console.log(`Creating peer for ${targetUserId}, initiator: ${initiator}`);
    
    const peer = new Peer({
      initiator,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          {
            urls: "turn:157.180.26.145:3478",
            username: "chatsoap",
            credential: "chatsoap2026",
          },
        ],
      },
    });

    peer.on("signal", async (signal: SignalData) => {
      console.log("Sending signal to:", targetUserId);
      await supabase.from("room_signals").insert({
        room_id: roomId!,
        from_user_id: userId!,
        to_user_id: targetUserId,
        signal_data: signal as unknown as Json,
      });
    });

    peer.on("stream", (remoteStream: MediaStream) => {
      console.log("Received stream from:", targetUserId);
      setParticipants((prev) => 
        prev.map((p) => 
          p.user_id === targetUserId ? { ...p, stream: remoteStream } : p
        )
      );
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
    });

    peer.on("close", () => {
      console.log("Peer connection closed:", targetUserId);
      peersRef.current.delete(targetUserId);
    });

    peersRef.current.set(targetUserId, { peerId: targetUserId, peer, stream });
    return peer;
  }, [roomId, userId]);

  // Handle incoming signals
  useEffect(() => {
    if (!roomId || !userId) return;

    const channel = supabase
      .channel(`signals-${roomId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_signals",
          filter: `to_user_id=eq.${userId}`,
        },
        async (payload) => {
          const signal = payload.new as {
            from_user_id: string;
            signal_data: SignalData;
            id: string;
          };
          
          console.log("Received signal from:", signal.from_user_id);
          
          const existingPeer = peersRef.current.get(signal.from_user_id);
          if (existingPeer) {
            existingPeer.peer.signal(signal.signal_data);
          } else if (localStreamRef.current) {
            // Create non-initiator peer
            const peer = createPeer(signal.from_user_id, false, localStreamRef.current);
            peer.signal(signal.signal_data);
          }
          
          // Clean up the signal
          await supabase.from("room_signals").delete().eq("id", signal.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, createPeer]);

  // Fetch and subscribe to presence
  useEffect(() => {
    if (!roomId || !userId) return;

    // Initial presence fetch
    const fetchPresence = async () => {
      const { data: presenceData } = await supabase
        .from("room_presence")
        .select("*, profiles:user_id(display_name)")
        .eq("room_id", roomId);
      
      if (presenceData) {
        const otherParticipants = presenceData
          .filter((p) => p.user_id !== userId)
          .map((p) => ({
            id: p.id,
            user_id: p.user_id,
            video_enabled: p.video_enabled || false,
            audio_enabled: p.audio_enabled || false,
            display_name: (p.profiles as any)?.display_name,
            stream: peersRef.current.get(p.user_id)?.stream,
          }));
        setParticipants(otherParticipants);
      }
    };

    fetchPresence();

    // Subscribe to presence changes
    const channel = supabase
      .channel(`presence-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_presence",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const presence = payload.new as any;
            if (presence.user_id === userId) return;
            
            // Fetch display name
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("user_id", presence.user_id)
              .single();
            
            setParticipants((prev) => {
              const exists = prev.find((p) => p.user_id === presence.user_id);
              if (exists) {
                return prev.map((p) =>
                  p.user_id === presence.user_id
                    ? { ...p, video_enabled: presence.video_enabled, audio_enabled: presence.audio_enabled }
                    : p
                );
              }
              return [
                ...prev,
                {
                  id: presence.id,
                  user_id: presence.user_id,
                  video_enabled: presence.video_enabled || false,
                  audio_enabled: presence.audio_enabled || false,
                  display_name: profile?.display_name,
                },
              ];
            });
            
            // If new participant and we have a stream, initiate connection
            const existingPeer = peersRef.current.has(presence.user_id);
            if (!existingPeer && localStreamRef.current) {
              createPeer(presence.user_id, true, localStreamRef.current);
            }
          } else if (payload.eventType === "DELETE") {
            const presence = payload.old as any;
            setParticipants((prev) => prev.filter((p) => p.user_id !== presence.user_id));
            
            // Clean up peer connection
            const peer = peersRef.current.get(presence.user_id);
            if (peer) {
              peer.peer.destroy();
              peersRef.current.delete(presence.user_id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, createPeer]);

  // Join room (set presence)
  const joinRoom = useCallback(async (video: boolean, audio: boolean) => {
    if (!roomId || !userId) return;
    
    const stream = await startLocalStream(video, audio);
    if (!stream) return;
    
    await supabase.from("room_presence").upsert({
      room_id: roomId,
      user_id: userId,
      video_enabled: video,
      audio_enabled: audio,
      updated_at: new Date().toISOString(),
    });
    
    // Connect to existing participants
    const { data: existingPresence } = await supabase
      .from("room_presence")
      .select("user_id")
      .eq("room_id", roomId)
      .neq("user_id", userId);
    
    if (existingPresence) {
      for (const presence of existingPresence) {
        if (!peersRef.current.has(presence.user_id)) {
          createPeer(presence.user_id, true, stream);
        }
      }
    }
  }, [roomId, userId, startLocalStream, createPeer]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (!roomId || !userId) return;
    
    // Clean up all peers
    peersRef.current.forEach((peerConn) => {
      peerConn.peer.destroy();
    });
    peersRef.current.clear();
    
    // Stop local stream
    stopLocalStream();
    
    // Remove presence
    await supabase
      .from("room_presence")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);
    
    setParticipants([]);
  }, [roomId, userId, stopLocalStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach((peerConn) => {
        peerConn.peer.destroy();
      });
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    localStream,
    screenStream,
    participants,
    videoEnabled,
    audioEnabled,
    isScreenSharing,
    isConnecting,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    joinRoom,
    leaveRoom,
  };
}