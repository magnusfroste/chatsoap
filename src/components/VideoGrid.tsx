import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";

interface Participant {
  id: string;
  user_id: string;
  video_enabled: boolean;
  audio_enabled: boolean;
  display_name?: string;
  stream?: MediaStream;
}

interface VideoGridProps {
  localStream: MediaStream | null;
  participants: Participant[];
  videoEnabled: boolean;
  audioEnabled: boolean;
  displayName?: string | null;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onLeaveCall: () => void;
}

function VideoTile({
  stream,
  displayName,
  videoEnabled,
  audioEnabled,
  isLocal = false,
  muted = false,
  isSpotlight = false,
}: {
  stream?: MediaStream | null;
  displayName?: string | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isLocal?: boolean;
  muted?: boolean;
  isSpotlight?: boolean;
}) {
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
    <div 
      className={`relative rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 overflow-hidden shadow-xl transition-all duration-300 hover:border-primary/50 ${
        isSpotlight ? 'col-span-2 row-span-2' : ''
      }`}
    >
      {stream && videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted || isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'transform scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700/50 to-slate-800/50">
          <Avatar className={`${isSpotlight ? 'w-24 h-24' : 'w-16 h-16'} ring-4 ring-white/10`}>
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white text-xl font-semibold">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
      
      {/* Name and status overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white font-medium truncate drop-shadow-lg">
            {isLocal ? "Du" : displayName || "Anonym"}
          </span>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-full ${audioEnabled ? 'bg-white/20' : 'bg-red-500/80'}`}>
              {audioEnabled ? (
                <Mic className="w-3.5 h-3.5 text-white" />
              ) : (
                <MicOff className="w-3.5 h-3.5 text-white" />
              )}
            </div>
            <div className={`p-1.5 rounded-full ${videoEnabled ? 'bg-white/20' : 'bg-red-500/80'}`}>
              {videoEnabled ? (
                <Video className="w-3.5 h-3.5 text-white" />
              ) : (
                <VideoOff className="w-3.5 h-3.5 text-white" />
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Local indicator */}
      {isLocal && (
        <div className="absolute top-3 left-3">
          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full font-medium shadow-lg">
            Du
          </span>
        </div>
      )}
      
      {/* Speaking indicator (pulse animation) */}
      {audioEnabled && (
        <div className="absolute top-3 right-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
        </div>
      )}
    </div>
  );
}

export function VideoGrid({
  localStream,
  participants,
  videoEnabled,
  audioEnabled,
  displayName,
  onToggleVideo,
  onToggleAudio,
  onLeaveCall,
}: VideoGridProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalParticipants = participants.length + 1; // +1 for local

  // Determine grid layout based on participant count
  const getGridClass = () => {
    if (totalParticipants === 1) return "grid-cols-1";
    if (totalParticipants === 2) return "grid-cols-2";
    if (totalParticipants <= 4) return "grid-cols-2";
    if (totalParticipants <= 6) return "grid-cols-3";
    return "grid-cols-4";
  };

  return (
    <div className={`bg-slate-900 ${isExpanded ? 'fixed inset-0 z-50' : 'rounded-xl'} flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-white text-sm font-medium">
            Gruppsamtal • {totalParticipants} deltagare
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Video grid */}
      <div className={`flex-1 p-4 ${isExpanded ? 'overflow-y-auto' : ''}`}>
        <div 
          className={`grid ${getGridClass()} gap-3 h-full`}
          style={{ 
            minHeight: isExpanded ? 'auto' : '200px',
            maxHeight: isExpanded ? 'none' : '400px' 
          }}
        >
          {/* Local video */}
          <VideoTile
            stream={localStream}
            displayName={displayName}
            videoEnabled={videoEnabled}
            audioEnabled={audioEnabled}
            isLocal
            muted
          />
          
          {/* Remote participants */}
          {participants.map((participant) => (
            <VideoTile
              key={participant.id}
              stream={participant.stream}
              displayName={participant.display_name}
              videoEnabled={participant.video_enabled}
              audioEnabled={participant.audio_enabled}
            />
          ))}
        </div>

        {participants.length === 0 && (
          <div className="flex items-center justify-center mt-4">
            <p className="text-white/50 text-sm">
              Väntar på andra deltagare...
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-4 py-4 border-t border-white/10 bg-slate-800/50">
        <Button
          variant={audioEnabled ? "secondary" : "destructive"}
          size="lg"
          className={`w-14 h-14 rounded-full ${audioEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : ''}`}
          onClick={onToggleAudio}
        >
          {audioEnabled ? (
            <Mic className="w-5 h-5" />
          ) : (
            <MicOff className="w-5 h-5" />
          )}
        </Button>
        
        <Button
          variant={videoEnabled ? "secondary" : "destructive"}
          size="lg"
          className={`w-14 h-14 rounded-full ${videoEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : ''}`}
          onClick={onToggleVideo}
        >
          {videoEnabled ? (
            <Video className="w-5 h-5" />
          ) : (
            <VideoOff className="w-5 h-5" />
          )}
        </Button>
        
        <Button
          variant="destructive"
          size="lg"
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700"
          onClick={onLeaveCall}
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
