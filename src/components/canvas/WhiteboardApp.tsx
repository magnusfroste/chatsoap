import { useState, useEffect } from "react";
import { Loader2, AlertCircle, PenTool } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CollaborativeCanvas } from "@/components/CollaborativeCanvas";

interface WhiteboardAppProps {
  conversationId: string;
  userId: string;
}

const WhiteboardApp = ({ conversationId, userId }: WhiteboardAppProps) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId || !userId) return;
    
    const setupRoom = async () => {
      try {
        // Check if room exists
        const { data: existingRoom } = await supabase
          .from("rooms")
          .select("id")
          .eq("id", conversationId)
          .single();

        if (!existingRoom) {
          // Create room with conversation ID
          const { error: createError } = await supabase
            .from("rooms")
            .insert({
              id: conversationId,
              name: "Whiteboard",
              created_by: userId,
            });

          if (createError && !createError.message.includes("duplicate")) {
            throw createError;
          }
        }

        // Ensure user is a member
        const { data: existingMember } = await supabase
          .from("room_members")
          .select("id")
          .eq("room_id", conversationId)
          .eq("user_id", userId)
          .single();

        if (!existingMember) {
          const { error: memberError } = await supabase
            .from("room_members")
            .insert({
              room_id: conversationId,
              user_id: userId,
            });

          if (memberError && !memberError.message.includes("duplicate")) {
            throw memberError;
          }
        }

        setIsReady(true);
      } catch (err) {
        console.error("Failed to setup whiteboard room:", err);
        setError("Failed to initialize whiteboard");
      }
    };

    setupRoom();
  }, [conversationId, userId]);

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-destructive gap-3">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Preparing whiteboard...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <PenTool className="w-8 h-8 mb-3 text-muted-foreground/50" />
        <p className="text-sm">Sign in to use the whiteboard</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <CollaborativeCanvas 
        roomId={conversationId} 
        userId={userId} 
      />
    </div>
  );
};

export default WhiteboardApp;
