import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Users, Plus, LogOut, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import NewChatDialog from "@/components/NewChatDialog";
import NewGroupDialog from "@/components/NewGroupDialog";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  last_message_at: string | null;
  created_at: string;
  other_user?: {
    id: string;
    display_name: string;
  };
  last_message?: string;
  unread_count?: number;
}

const Chats = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchConversations();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel("conversations-updates")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
          },
          () => {
            fetchConversations();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          () => {
            fetchConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;

    try {
      // Get all conversations user is member of
      const { data: memberData, error: memberError } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (memberError) throw memberError;

      if (!memberData || memberData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = memberData.map((m) => m.conversation_id);

      // Get conversations
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (convError) throw convError;

      // For each conversation, get additional info
      const enrichedConversations = await Promise.all(
        (convData || []).map(async (conv) => {
          let otherUser = null;
          
          if (conv.type === "direct") {
            // Get the other user in direct conversation
            const { data: members } = await supabase
              .from("conversation_members")
              .select("user_id")
              .eq("conversation_id", conv.id)
              .neq("user_id", user.id)
              .single();

            if (members) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("user_id, display_name")
                .eq("user_id", members.user_id)
                .single();

              if (profile) {
                otherUser = {
                  id: profile.user_id,
                  display_name: profile.display_name || "Användare",
                };
              }
            }
          }

          // Get last message
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("content")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          return {
            ...conv,
            other_user: otherUser,
            last_message: lastMsg?.content || null,
          } as Conversation;
        })
      );

      setConversations(enrichedConversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const getDisplayName = (conv: Conversation) => {
    if (conv.type === "direct") {
      return conv.other_user?.display_name || "Användare";
    }
    return conv.name || "Grupp";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredConversations = conversations.filter((conv) => {
    const name = getDisplayName(conv).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleConversationClick = (conv: Conversation) => {
    if (conv.type === "direct") {
      navigate(`/chat/${conv.id}`);
    } else {
      navigate(`/group/${conv.id}`);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Chattar</h1>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Search and Actions */}
      <div className="container mx-auto px-4 py-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Sök chattar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setNewChatOpen(true)}
            className="flex-1"
            variant="outline"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Ny chatt
          </Button>
          <Button
            onClick={() => setNewGroupOpen(true)}
            className="flex-1"
            variant="default"
          >
            <Users className="w-4 h-4 mr-2" />
            Ny grupp
          </Button>
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="container mx-auto px-4 pb-4">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Inga chattar ännu</p>
              <p className="text-sm mt-2">
                Starta en ny chatt eller skapa en grupp
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleConversationClick(conv)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors text-left"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarFallback
                      className={
                        conv.type === "group"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }
                    >
                      {conv.type === "group" ? (
                        <Users className="w-5 h-5" />
                      ) : (
                        getInitials(getDisplayName(conv))
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground truncate">
                        {getDisplayName(conv)}
                      </span>
                      {conv.last_message_at && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conv.last_message_at), {
                            addSuffix: true,
                            locale: sv,
                          })}
                        </span>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message}
                      </p>
                    )}
                    {conv.type === "group" && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          Arbetsrum
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Dialogs */}
      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onChatCreated={(id) => navigate(`/chat/${id}`)}
      />
      <NewGroupDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        onGroupCreated={(id) => navigate(`/group/${id}`)}
      />
    </div>
  );
};

export default Chats;
