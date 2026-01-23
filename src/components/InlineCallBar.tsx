import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic, MicOff, Video, Maximize2 } from "lucide-react";
import { CallStatus, CallType } from "@/hooks/useDirectCall";
import { cn } from "@/lib/utils";

interface InlineCallBarProps {
  status: CallStatus;
  callType: CallType;
  remoteUserName: string | null;
  remoteStream: MediaStream | null;
  audioEnabled: boolean;
  onEnd: () => void;
  onToggleAudio: () => void;
  onExpandToVideo?: () => void;
}

export function InlineCallBar({
  status,
  callType,
  remoteUserName,
  remoteStream,
  audioEnabled,
  onEnd,
  onToggleAudio,
  onExpandToVideo,
}: InlineCallBarProps) {
  const [duration, setDuration] = useState(0);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Call duration timer
  useEffect(() => {
    if (status !== "connected") {
      setDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Attach remote audio stream
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusText = () => {
    switch (status) {
      case "calling":
        return "Calling...";
      case "ringing":
        return "Ringing...";
      case "connected":
        return formatDuration(duration);
      default:
        return "";
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 border border-green-500/30 rounded-full">
      {/* Hidden audio element */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Pulsing indicator */}
      <div className="relative">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        {status === "connected" && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping" />
        )}
      </div>

      {/* Call info */}
      <div className="flex items-center gap-2 text-sm">
        <Phone className="w-3.5 h-3.5 text-green-500" />
        <span className="text-foreground font-medium max-w-[100px] truncate">
          {remoteUserName || "Call"}
        </span>
        <span className="text-muted-foreground text-xs">{getStatusText()}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 ml-1">
        <Button
          onClick={onToggleAudio}
          size="icon"
          variant="ghost"
          className={cn(
            "h-7 w-7 rounded-full",
            !audioEnabled && "bg-red-500/20 text-red-500"
          )}
        >
          {audioEnabled ? (
            <Mic className="w-3.5 h-3.5" />
          ) : (
            <MicOff className="w-3.5 h-3.5" />
          )}
        </Button>

        {callType === "audio" && onExpandToVideo && (
          <Button
            onClick={onExpandToVideo}
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full"
            title="Switch to video"
          >
            <Video className="w-3.5 h-3.5" />
          </Button>
        )}

        <Button
          onClick={onEnd}
          size="icon"
          className="h-7 w-7 rounded-full bg-red-600 hover:bg-red-700"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}