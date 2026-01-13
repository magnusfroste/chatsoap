import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Users, LogOut, Search, MoreVertical, CheckCheck, Settings, Star, Archive, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import NewChatDialog from "@/components/NewChatDialog";
import NewGroupDialog from "@/components/NewGroupDialog";
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

interface ChatSidebarProps {
  activeConversationId?: string;
  onConversationSelect?: (conv: Conversation) => void;
}

const ChatSidebar = ({ activeConversationId, onConversationSelect }: ChatSidebarProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchConversations();
      
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

      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (convError) throw convError;

      const enrichedConversations = await Promise.all(
        (convData || []).map(async (conv) => {
          let otherUser = null;
          
          if (conv.type === "direct") {
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
    if (onConversationSelect) {
      onConversationSelect(conv);
    }
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
      return date.toLocaleDateString("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit" });
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Chats</h1>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setNewChatOpen(true)}
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-muted">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="w-4 h-4 mr-2" />
                  Profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNewGroupOpen(true)}>
                  <Users className="w-4 h-4 mr-2" />
                  Ny grupp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin")}>
                  <Settings className="w-4 h-4 mr-2" />
                  Inställningar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logga ut
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="flex-shrink-0 px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/50 border-0 rounded-lg h-9 text-sm focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Inga chattar ännu</p>
            <Button 
              variant="link" 
              className="text-primary mt-2"
              onClick={() => setNewChatOpen(true)}
            >
              Starta en ny chatt
            </Button>
          </div>
        ) : (
          <div>
            {filteredConversations.map((conv) => {
              const isActive = activeConversationId === conv.id;
              
              return (
                <button
                  key={conv.id}
                  onClick={() => handleConversationClick(conv)}
                  className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50 ${
                    isActive ? "bg-muted" : ""
                  }`}
                >
                  {/* Avatar */}
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback
                      className={
                        conv.type === "group"
                          ? "bg-muted text-muted-foreground font-medium"
                          : "bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground font-medium"
                      }
                    >
                      {conv.type === "group" ? (
                        <Users className="w-5 h-5" />
                      ) : (
                        getInitials(getDisplayName(conv))
                      )}
                    </AvatarFallback>
                  </Avatar>

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
                      <CheckCheck className="w-4 h-4 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message || (conv.type === "group" ? "Gruppchatt" : "Ny konversation")}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Bottom nav icons like WhatsApp */}
      <div className="flex-shrink-0 border-t border-border px-4 py-2 flex items-center justify-around text-muted-foreground">
        <Button variant="ghost" size="icon" className="hover:bg-muted">
          <MessageSquare className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="hover:bg-muted">
          <Star className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="hover:bg-muted">
          <Archive className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="hover:bg-muted" onClick={() => navigate("/admin")}>
          <Settings className="w-5 h-5" />
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

export default ChatSidebar;
