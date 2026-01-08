import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

interface VideoParticipantProps {
  stream?: MediaStream | null;
  displayName?: string | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isLocal?: boolean;
  muted?: boolean;
}

export function VideoParticipant({
  stream,
  displayName,
  videoEnabled,
  audioEnabled,
  isLocal = false,
  muted = false,
}: VideoParticipantProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return isLocal ? "Du" : "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="relative aspect-video rounded-lg bg-valhalla-surface border border-border overflow-hidden group">
      {stream && videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted || isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Avatar className="w-12 h-12">
            <AvatarFallback className="bg-primary/20 text-primary">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      
      {/* Name and status overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white font-medium truncate">
            {isLocal ? "Du" : displayName || "Anonym"}
          </span>
          <div className="flex items-center gap-1">
            {audioEnabled ? (
              <Mic className="w-3 h-3 text-white" />
            ) : (
              <MicOff className="w-3 h-3 text-red-400" />
            )}
            {videoEnabled ? (
              <Video className="w-3 h-3 text-white" />
            ) : (
              <VideoOff className="w-3 h-3 text-red-400" />
            )}
          </div>
        </div>
      </div>
      
      {/* Local indicator */}
      {isLocal && (
        <div className="absolute top-2 left-2">
          <span className="text-[10px] bg-primary/80 text-primary-foreground px-1.5 py-0.5 rounded">
            DU
          </span>
        </div>
      )}
    </div>
  );
}