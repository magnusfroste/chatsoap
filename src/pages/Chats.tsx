import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Users, Plus, LogOut, Search, MoreVertical, Check, CheckCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import NewChatDialog from "@/components/NewChatDialog";
import NewGroupDialog from "@/components/NewGroupDialog";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Igår";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("sv-SE", { weekday: "short" });
    } else {
      return date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-whatsapp-green"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* WhatsApp-style Header */}
      <header className="bg-whatsapp-green text-white shadow-md sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">Silicon Valhalla</h1>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-whatsapp-green-dark"
                onClick={() => setSearchQuery(searchQuery ? "" : " ")}
              >
                <Search className="w-5 h-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-whatsapp-green-dark">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setNewGroupOpen(true)}>
                    <Users className="w-4 h-4 mr-2" />
                    Ny grupp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logga ut
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Search Bar (conditionally shown) */}
        {searchQuery !== "" && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Sök..."
                value={searchQuery.trim()}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white text-foreground border-0 rounded-full"
                autoFocus
              />
            </div>
          </div>
        )}
      </header>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-whatsapp-light-green flex items-center justify-center">
                <MessageSquare className="w-12 h-12 text-whatsapp-green" />
              </div>
              <p className="text-lg font-medium">Inga chattar ännu</p>
              <p className="text-sm mt-2">
                Tryck på + för att starta en ny chatt
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleConversationClick(conv)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                {/* Avatar with online indicator */}
                <div className="relative">
                  <Avatar className="h-12 w-12 ring-2 ring-transparent">
                    <AvatarFallback
                      className={
                        conv.type === "group"
                          ? "bg-whatsapp-teal text-white font-medium"
                          : "bg-gradient-to-br from-whatsapp-green to-whatsapp-teal text-white font-medium"
                      }
                    >
                      {conv.type === "group" ? (
                        <Users className="w-5 h-5" />
                      ) : (
                        getInitials(getDisplayName(conv))
                      )}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online status indicator for direct chats */}
                  {conv.type === "direct" && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-online border-2 border-background rounded-full" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground truncate">
                      {getDisplayName(conv)}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {/* Read indicators */}
                    <CheckCheck className="w-4 h-4 text-whatsapp-green flex-shrink-0" />
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message || (conv.type === "group" ? "Arbetsrum med whiteboard & video" : "Ny konversation")}
                    </p>
                  </div>
                </div>

                {/* Unread badge or group indicator */}
                {conv.type === "group" && !conv.last_message && (
                  <span className="flex-shrink-0 w-2 h-2 bg-whatsapp-green rounded-full" />
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        {/* Secondary FAB for new group */}
        <Button
          onClick={() => setNewGroupOpen(true)}
          size="icon"
          className="w-12 h-12 rounded-full bg-whatsapp-teal hover:bg-whatsapp-green-dark shadow-lg"
        >
          <Users className="w-5 h-5" />
        </Button>
        
        {/* Primary FAB for new chat */}
        <Button
          onClick={() => setNewChatOpen(true)}
          size="icon"
          className="w-14 h-14 rounded-full bg-whatsapp-green hover:bg-whatsapp-green-dark shadow-lg shadow-whatsapp-green/30"
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      </div>

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
