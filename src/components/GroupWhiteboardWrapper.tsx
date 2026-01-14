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
      if (!conversationId || !userId) {
        console.log("Missing conversationId or userId");
        return;
      }

      console.log("Setting up whiteboard for conversation:", conversationId);

      try {
        // First, try to create the room - if it exists, this will fail with a unique constraint error
        // which we can ignore
        const { error: roomError } = await supabase.from("rooms").insert({
          id: conversationId,
          name: groupName || "Whiteboard",
          created_by: userId,
        });

        if (roomError) {
          // Ignore "duplicate key" errors - means room already exists
          if (!roomError.message.includes("duplicate") && !roomError.code?.includes("23505")) {
            console.error("Error creating room:", roomError);
            // Don't fail - room might exist but we can't see it due to RLS
          }
        } else {
          console.log("Room created successfully");
        }

        // Now try to add user as room member
        const { error: memberError } = await supabase.from("room_members").insert({
          room_id: conversationId,
          user_id: userId,
        });

        if (memberError) {
          // Ignore "duplicate key" errors - means user is already a member
          if (!memberError.message.includes("duplicate") && !memberError.code?.includes("23505")) {
            console.error("Error adding room member:", memberError);
            // Don't fail - might be RLS or already exists
          }
        } else {
          console.log("User added as room member");
        }

        // Small delay to let RLS propagate
        await new Promise(resolve => setTimeout(resolve, 100));

        setIsReady(true);
        console.log("Whiteboard ready!");
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
