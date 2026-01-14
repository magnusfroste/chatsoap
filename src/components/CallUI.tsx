import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Monitor, MonitorOff } from "lucide-react";
import { CallStatus, CallType } from "@/hooks/useDirectCall";
import { cn } from "@/lib/utils";

interface CallUIProps {
  status: CallStatus;
  callType: CallType;
  isIncoming: boolean;
  remoteUserName: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenStream?: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare?: () => void;
}

export function CallUI({
  status,
  callType,
  isIncoming,
  remoteUserName,
  localStream,
  remoteStream,
  screenStream,
  audioEnabled,
  videoEnabled,
  isScreenSharing = false,
  onAccept,
  onDecline,
  onEnd,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
}: CallUIProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream]);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getStatusText = () => {
    switch (status) {
      case "calling":
        return "Ringer...";
      case "ringing":
        return isIncoming ? "Inkommande samtal" : "Ringer...";
      case "connected":
        return "Ansluten";
      default:
        return "";
    }
  };

  // Incoming call overlay
  if (status === "ringing" && isIncoming) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
        <div className="text-center space-y-6">
          <Avatar className="w-24 h-24 mx-auto border-4 border-primary/30">
            <AvatarFallback className="bg-primary/20 text-primary text-2xl">
              {getInitials(remoteUserName)}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <h2 className="text-xl font-semibold text-white">{remoteUserName || "Okänd"}</h2>
            <p className="text-muted-foreground mt-1">
              {callType === "video" ? "Videosamtal" : "Röstsamtal"}
            </p>
          </div>

          {/* Pulsing ring animation */}
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-green-500/30 animate-ping animation-delay-200" />
          </div>

          <div className="flex items-center justify-center gap-8 pt-4">
            <Button
              onClick={onDecline}
              size="lg"
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
            <Button
              onClick={onAccept}
              size="lg"
              className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700"
            >
              {callType === "video" ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active call UI
  if (status === "calling" || status === "connected") {
    const isVideoCall = callType === "video" || videoEnabled;

    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Remote video/avatar */}
        <div className="flex-1 relative">
          {remoteStream && isVideoCall ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black">
              <Avatar className="w-32 h-32 border-4 border-primary/30">
                <AvatarFallback className="bg-primary/20 text-primary text-4xl">
                  {getInitials(remoteUserName)}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-semibold text-white mt-6">{remoteUserName || "Okänd"}</h2>
              <p className="text-muted-foreground mt-2">{getStatusText()}</p>
            </div>
          )}

          {/* Audio element for audio calls */}
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

          {/* Local video preview (picture-in-picture) */}
          {localStream && isVideoCall && (
            <div className="absolute top-4 right-4 w-32 aspect-video rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
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

        {/* Call controls */}
        <div className="flex-shrink-0 bg-black/80 backdrop-blur-sm p-6">
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={onToggleAudio}
              size="lg"
              variant="ghost"
              className={cn(
                "w-14 h-14 rounded-full",
                !audioEnabled ? "bg-red-600/20 text-red-500" : "bg-white/10 text-white"
              )}
            >
              {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </Button>

            <Button
              onClick={onToggleVideo}
              size="lg"
              variant="ghost"
              className={cn(
                "w-14 h-14 rounded-full",
                !videoEnabled ? "bg-red-600/20 text-red-500" : "bg-white/10 text-white"
              )}
            >
              {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </Button>

            {onToggleScreenShare && (
              <Button
                onClick={onToggleScreenShare}
                size="lg"
                variant="ghost"
                className={cn(
                  "w-14 h-14 rounded-full",
                  isScreenSharing ? "bg-primary/20 text-primary" : "bg-white/10 text-white"
                )}
              >
                {isScreenSharing ? <Monitor className="w-6 h-6" /> : <MonitorOff className="w-6 h-6" />}
              </Button>
            )}

            <Button
              onClick={onEnd}
              size="lg"
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
