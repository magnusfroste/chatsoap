import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { CollaborativeCanvas } from "./CollaborativeCanvas";

interface GroupWhiteboardWrapperProps {
  conversationId: string;
  userId: string;
  groupName: string;
}

export const GroupWhiteboardWrapper = ({ 
  conversationId, 
  userId, 
  groupName 
}: GroupWhiteboardWrapperProps) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ensureRoomExists = async () => {
      if (!conversationId || !userId) return;

      try {
        // Check if room exists for this conversation
        const { data: existingRoom } = await supabase
          .from("rooms")
          .select("id")
          .eq("id", conversationId)
          .maybeSingle();

        if (!existingRoom) {
          // Create room with same ID as conversation
          const { error: roomError } = await supabase.from("rooms").insert({
            id: conversationId,
            name: groupName || "Whiteboard",
            created_by: userId,
          });

          if (roomError && !roomError.message.includes("duplicate")) {
            console.error("Error creating room:", roomError);
            setError("Kunde inte skapa whiteboard");
            return;
          }
        }

        // Ensure user is a room member
        const { data: existingMember } = await supabase
          .from("room_members")
          .select("id")
          .eq("room_id", conversationId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingMember) {
          const { error: memberError } = await supabase.from("room_members").insert({
            room_id: conversationId,
            user_id: userId,
          });

          if (memberError && !memberError.message.includes("duplicate")) {
            console.error("Error adding room member:", memberError);
            setError("Kunde inte gå med i whiteboard");
            return;
          }
        }

        setIsReady(true);
      } catch (err) {
        console.error("Error setting up whiteboard:", err);
        setError("Ett fel uppstod");
      }
    };

    ensureRoomExists();
  }, [conversationId, userId, groupName]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-whatsapp-green" />
      </div>
    );
  }

  return <CollaborativeCanvas roomId={conversationId} userId={userId} />;
};
