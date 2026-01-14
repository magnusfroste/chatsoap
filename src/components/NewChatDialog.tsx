import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Loader2, Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
interface Profile {
  user_id: string;
  display_name: string;
}

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatCreated: (conversationId: string) => void;
}

const NewChatDialog = ({ open, onOpenChange, onChatCreated }: NewChatDialogProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .neq("user_id", user.id)
        .order("display_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (selectedUser: Profile) => {
    if (!user || creating) return;
    setCreating(true);

    try {
      // Check if a direct conversation already exists between these users
      const { data: myConversations } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      const myConvIds = myConversations?.map((c) => c.conversation_id) || [];

      if (myConvIds.length > 0) {
        // Check if selected user is in any of these conversations
        const { data: sharedConversations } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", selectedUser.user_id)
          .in("conversation_id", myConvIds);

        if (sharedConversations && sharedConversations.length > 0) {
          // Check if any of these are direct conversations
          for (const conv of sharedConversations) {
            const { data: convData } = await supabase
              .from("conversations")
              .select("id, type")
              .eq("id", conv.conversation_id)
              .eq("type", "direct")
              .single();

            if (convData) {
              // Found existing direct conversation
              onChatCreated(convData.id);
              onOpenChange(false);
              return;
            }
          }
        }
      }

      // Create new direct conversation
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          type: "direct",
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add both users as members
      const { error: membersError } = await supabase
        .from("conversation_members")
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: selectedUser.user_id },
        ]);

      if (membersError) throw membersError;

      onChatCreated(newConv.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating conversation:", error);
    } finally {
      setCreating(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredUsers = users.filter((u) =>
    u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateAIChat = async () => {
    if (!user || creating) return;
    setCreating(true);

    try {
      // Create new AI conversation
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          type: "ai_chat",
          name: "AI Assistent",
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add user as the only member
      const { error: membersError } = await supabase
        .from("conversation_members")
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
        ]);

      if (membersError) throw membersError;

      onChatCreated(newConv.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating AI conversation:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ny chatt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* AI Chat Button - Prominent placement */}
          <Button
            onClick={handleCreateAIChat}
            disabled={creating}
            className="w-full h-auto p-4 flex items-center gap-4 bg-gradient-to-r from-primary/90 to-accent/90 hover:from-primary hover:to-accent text-primary-foreground rounded-xl transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold flex items-center gap-2">
                Chatta med AI
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-sm opacity-80 font-normal">
                Starta en privat AI-konversation
              </p>
            </div>
            {creating && <Loader2 className="w-5 h-5 animate-spin" />}
          </Button>

          <div className="relative flex items-center gap-2 py-2">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground px-2">eller chatta med</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Sök användare..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Inga användare hittades
              </div>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => handleSelectUser(u)}
                    disabled={creating}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors text-left disabled:opacity-50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {getInitials(u.display_name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">
                      {u.display_name || "Användare"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;
