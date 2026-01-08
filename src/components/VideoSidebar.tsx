import { Button } from "@/components/ui/button";
import { VideoParticipant } from "./VideoParticipant";
import { Users, Video, VideoOff, Mic, MicOff, PhoneOff, Phone, Loader2 } from "lucide-react";

interface Participant {
  id: string;
  user_id: string;
  video_enabled: boolean;
  audio_enabled: boolean;
  display_name?: string;
  stream?: MediaStream;
}

interface VideoSidebarProps {
  localStream: MediaStream | null;
  participants: Participant[];
  videoEnabled: boolean;
  audioEnabled: boolean;
  isConnecting: boolean;
  isInCall: boolean;
  displayName?: string | null;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onJoinCall: () => void;
  onLeaveCall: () => void;
}

export function VideoSidebar({
  localStream,
  participants,
  videoEnabled,
  audioEnabled,
  isConnecting,
  isInCall,
  displayName,
  onToggleVideo,
  onToggleAudio,
  onJoinCall,
  onLeaveCall,
}: VideoSidebarProps) {
  return (
    <div className="w-72 border-l border-border/50 bg-card/50 p-4 hidden lg:flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Deltagare</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {isInCall ? participants.length + 1 : 0} online
        </span>
      </div>

      {/* Video grid */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {isInCall ? (
          <>
            {/* Local video */}
            <VideoParticipant
              stream={localStream}
              displayName={displayName}
              videoEnabled={videoEnabled}
              audioEnabled={audioEnabled}
              isLocal
              muted
            />
            
            {/* Remote participants */}
            {participants.map((participant) => (
              <VideoParticipant
                key={participant.id}
                stream={participant.stream}
                displayName={participant.display_name}
                videoEnabled={participant.video_enabled}
                audioEnabled={participant.audio_enabled}
              />
            ))}
            
            {participants.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Väntar på andra deltagare...
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Video className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Gå med i samtalet för att se och höra andra deltagare
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3">
        {isInCall ? (
          <>
            <div className="flex gap-2">
              <Button
                variant={videoEnabled ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={onToggleVideo}
              >
                {videoEnabled ? (
                  <Video className="w-4 h-4 mr-2" />
                ) : (
                  <VideoOff className="w-4 h-4 mr-2" />
                )}
                Video
              </Button>
              <Button
                variant={audioEnabled ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={onToggleAudio}
              >
                {audioEnabled ? (
                  <Mic className="w-4 h-4 mr-2" />
                ) : (
                  <MicOff className="w-4 h-4 mr-2" />
                )}
                Ljud
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={onLeaveCall}
            >
              <PhoneOff className="w-4 h-4 mr-2" />
              Lämna samtal
            </Button>
          </>
        ) : (
          <Button
            className="w-full gradient-valhalla hover:opacity-90"
            onClick={onJoinCall}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Phone className="w-4 h-4 mr-2" />
            )}
            {isConnecting ? "Ansluter..." : "Gå med i samtal"}
          </Button>
        )}
      </div>
    </div>
  );
}