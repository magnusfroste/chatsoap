import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IncomingCall } from "@/hooks/useIncomingCallListener";
import { useRingtone } from "@/hooks/useRingtone";

interface IncomingCallOverlayProps {
  call: IncomingCall;
  onAccept: () => Promise<string | null>;
  onDecline: () => Promise<void>;
}

export function IncomingCallOverlay({ call, onAccept, onDecline }: IncomingCallOverlayProps) {
  const navigate = useNavigate();
  const { startRingtone, stopRingtone } = useRingtone();

  // Start ringtone when component mounts (incoming call appears)
  useEffect(() => {
    startRingtone();
    
    // Stop ringtone when component unmounts
    return () => {
      stopRingtone();
    };
  }, [startRingtone, stopRingtone]);

  const handleAccept = async () => {
    stopRingtone();
    const conversationId = await onAccept();
    if (conversationId) {
      navigate(`/chat/${conversationId}?autoJoinCall=true`);
    }
  };

  const handleDecline = async () => {
    stopRingtone();
    await onDecline();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-6 min-w-[300px]">
        {/* Caller avatar */}
        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
          {call.callType === "video" ? (
            <Video className="w-10 h-10 text-primary" />
          ) : (
            <Phone className="w-10 h-10 text-primary" />
          )}
        </div>

        {/* Caller info */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {call.callerName || "Unknown user"}
          </h2>
          <p className="text-muted-foreground mt-1">
            Incoming {call.callType === "video" ? "video call" : "voice call"}...
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-6 mt-4">
          <Button
            onClick={handleDecline}
            variant="destructive"
            size="lg"
            className="w-16 h-16 rounded-full p-0"
          >
            <PhoneOff className="w-7 h-7" />
          </Button>
          <Button
            onClick={handleAccept}
            size="lg"
            className="w-16 h-16 rounded-full p-0 bg-green-600 hover:bg-green-700"
          >
            {call.callType === "video" ? (
              <Video className="w-7 h-7" />
            ) : (
              <Phone className="w-7 h-7" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
