import { useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Conversation {
  id: string;
  name: string;
  type: "direct" | "group";
}

interface SendToChatButtonProps {
  content: string;
  userId: string;
  sourceNoteId?: string;
  variant?: "ghost" | "outline" | "secondary";
  size?: "sm" | "default" | "icon";
  className?: string;
}

export const SendToChatButton = ({
  content,
  userId,
  sourceNoteId,
  variant = "ghost",
  size = "sm",
  className,
}: SendToChatButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const navigate = useNavigate();

  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      // Fetch user's conversation memberships
      const { data: memberships, error: memberError } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", userId);

      if (memberError) throw memberError;

      const conversationIds = memberships?.map(m => m.conversation_id) || [];
      
      if (conversationIds.length === 0) {
        setConversations([]);
        return;
      }

      // Fetch conversations
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("id, name, type")
        .in("id", conversationIds);

      if (convError) throw convError;

      const result: Conversation[] = [];

      for (const conv of convData || []) {
        if (conv.type === "group") {
          result.push({
            id: conv.id,
            name: conv.name || "Grupp",
            type: "group",
          });
        } else {
          // For direct chats, get the other participant's name
          const { data: otherMember } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conv.id)
            .neq("user_id", userId)
            .single();

          if (otherMember) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", otherMember.user_id)
              .single();

            result.push({
              id: conv.id,
              name: profile?.display_name || "Okänd",
              type: "direct",
            });
          }
        }
      }

      setConversations(result);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      toast.error("Kunde inte hämta konversationer");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    fetchConversations();
  };

  const sendToChat = async (conversation: Conversation) => {
    setIsSending(true);
    try {
      // Truncate content if too long and add note reference
      const maxLength = 2000;
      let messageContent = content;
      if (content.length > maxLength) {
        messageContent = content.slice(0, maxLength) + "...\n\n_(Från anteckning)_";
      } else {
        messageContent = content + "\n\n_(Från anteckning)_";
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: userId,
        content: messageContent,
      });

      if (error) throw error;

      toast.success(`Skickat till ${conversation.name}`);
      setIsOpen(false);

      // Navigate to the conversation
      if (conversation.type === "direct") {
        navigate(`/chat/${conversation.id}`);
      } else {
        navigate(`/group/${conversation.id}`);
      }
    } catch (error) {
      console.error("Error sending to chat:", error);
      toast.error("Kunde inte skicka till chatten");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleOpen}
        className={className}
      >
        <MessageSquare className="w-4 h-4 mr-2" />
        Skicka till Chat
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Skicka till Chat</DialogTitle>
            <DialogDescription>
              Välj en konversation att skicka anteckningens innehåll till.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Inga konversationer hittades
            </p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => sendToChat(conv)}
                    disabled={isSending}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{conv.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {conv.type === "direct" ? "Direktmeddelande" : "Gruppchatt"}
                      </p>
                    </div>
                    {isSending && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
