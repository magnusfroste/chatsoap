import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  Monitor,
  MonitorOff,
  GripHorizontal,
} from "lucide-react";
import { CallStatus, CallType } from "@/hooks/useDirectCall";
import { cn } from "@/lib/utils";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { AudioLevelIndicator } from "@/components/AudioLevelIndicator";

interface FloatingVideoCallProps {
  status: CallStatus;
  callType: CallType;
  remoteUserName: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenStream?: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing?: boolean;
  onEnd: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare?: () => void;
  onMaximize?: () => void;
}

type Position = { x: number; y: number };
type Size = "minimized" | "small" | "medium";

export function FloatingVideoCall({
  status,
  callType,
  remoteUserName,
  localStream,
  remoteStream,
  screenStream,
  audioEnabled,
  videoEnabled,
  isScreenSharing = false,
  onEnd,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onMaximize,
}: FloatingVideoCallProps) {
  const [size, setSize] = useState<Size>("small");
  const [position, setPosition] = useState<Position>({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [duration, setDuration] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Audio level monitoring
  const localAudioLevel = useAudioLevel(localStream, audioEnabled && status === "connected");
  const remoteAudioLevel = useAudioLevel(remoteStream, status === "connected");

  // Duration timer
  useEffect(() => {
    if (status !== "connected") {
      setDuration(0);
      return;
    }
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Attach video streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffset.x));
      const y = Math.max(0, Math.min(window.innerHeight - 150, e.clientY - dragOffset.y));
      setPosition({ x, y });
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const isVideoCall = callType === "video" || videoEnabled;

  const sizeStyles = {
    minimized: "w-48 h-auto",
    small: "w-64 h-auto",
    medium: "w-96 h-auto",
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden transition-all duration-200",
        sizeStyles[size],
        isDragging && "cursor-grabbing"
      )}
      style={{ left: position.x, top: position.y }}
    >
      {/* Hidden audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Drag handle */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-muted/50 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate max-w-[120px]">
            {remoteUserName || "Video Call"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {status === "connected" ? formatDuration(duration) : "Connecting..."}
          </span>
          {size !== "minimized" && (
            <Button
              onClick={() => setSize("minimized")}
              size="icon"
              variant="ghost"
              className="h-6 w-6"
            >
              <Minimize2 className="w-3 h-3" />
            </Button>
          )}
          {size === "minimized" && (
            <Button
              onClick={() => setSize("small")}
              size="icon"
              variant="ghost"
              className="h-6 w-6"
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Video area - only shown when not minimized */}
      {size !== "minimized" && (
        <div className="relative aspect-video bg-black">
          {remoteStream && isVideoCall ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="bg-primary/20 text-primary text-xl">
                  {getInitials(remoteUserName)}
                </AvatarFallback>
              </Avatar>
            </div>
          )}

          {/* Local video PiP */}
          {localStream && isVideoCall && (
            <div className="absolute bottom-2 right-2 w-20 aspect-video rounded-lg overflow-hidden border border-white/20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 p-2 bg-muted/30">
        {/* Audio level indicators */}
        {status === "connected" && (
          <div className="flex items-center gap-1 mr-1">
            <AudioLevelIndicator level={localAudioLevel} size="sm" />
            <AudioLevelIndicator level={remoteAudioLevel} size="sm" />
          </div>
        )}

        <Button
          onClick={onToggleAudio}
          size="icon"
          variant="ghost"
          className={cn(
            "h-8 w-8 rounded-full",
            !audioEnabled && "bg-red-500/20 text-red-500"
          )}
        >
          {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </Button>

        <Button
          onClick={onToggleVideo}
          size="icon"
          variant="ghost"
          className={cn(
            "h-8 w-8 rounded-full",
            !videoEnabled && "bg-red-500/20 text-red-500"
          )}
        >
          {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </Button>

        {onToggleScreenShare && (
          <Button
            onClick={onToggleScreenShare}
            size="icon"
            variant="ghost"
            className={cn(
              "h-8 w-8 rounded-full",
              isScreenSharing && "bg-primary/20 text-primary"
            )}
          >
            {isScreenSharing ? <Monitor className="w-4 h-4" /> : <MonitorOff className="w-4 h-4" />}
          </Button>
        )}

        {size !== "medium" && (
          <Button
            onClick={() => setSize("medium")}
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        )}

        <Button
          onClick={onEnd}
          size="icon"
          className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700"
        >
          <PhoneOff className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}