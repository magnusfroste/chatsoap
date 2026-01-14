import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Users, LogOut, Search, MoreVertical, CheckCheck, Settings, Star, Archive, User, Pin, BellOff, ArchiveRestore, PanelLeftClose, PanelLeft } from "lucide-react";
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
  is_pinned?: boolean;
  is_favorite?: boolean;
  is_archived?: boolean;
  is_muted?: boolean;
  is_deleted?: boolean;
}

interface ChatSidebarProps {
  activeConversationId?: string;
  onConversationSelect?: (conv: Conversation) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ChatSidebar = ({ activeConversationId, onConversationSelect, isCollapsed = false, onToggleCollapse }: ChatSidebarProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "favorites" | "archived">("all");

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
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "message_read_receipts",
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
      // Fetch member data with settings
      const { data: memberData, error: memberError } = await supabase
        .from("conversation_members")
        .select("conversation_id, is_pinned, is_favorite, is_archived, is_muted, is_deleted")
        .eq("user_id", user.id)
        .eq("is_deleted", false); // Don't show soft-deleted

      if (memberError) throw memberError;

      if (!memberData || memberData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = memberData.map((m) => m.conversation_id);
      const memberSettingsMap = new Map(memberData.map(m => [m.conversation_id, m]));

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

          // Count unread messages (messages not read by current user)
          const { count: unreadCount } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .neq("user_id", user.id)
            .not("id", "in", `(
              SELECT message_id FROM message_read_receipts WHERE user_id = '${user.id}'
            )`);

          const settings = memberSettingsMap.get(conv.id);

          return {
            ...conv,
            other_user: otherUser,
            last_message: lastMsg?.content || null,
            unread_count: unreadCount || 0,
            is_pinned: settings?.is_pinned || false,
            is_favorite: settings?.is_favorite || false,
            is_archived: settings?.is_archived || false,
            is_muted: settings?.is_muted || false,
            is_deleted: settings?.is_deleted || false,
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

  // Filter and sort conversations
  const filteredConversations = conversations
    .filter((conv) => {
      const name = getDisplayName(conv).toLowerCase();
      const matchesSearch = name.includes(searchQuery.toLowerCase());
      
      // Apply filter based on current view
      if (filter === "archived") {
        return matchesSearch && conv.is_archived;
      }
      if (filter === "favorites") {
        return matchesSearch && conv.is_favorite && !conv.is_archived;
      }
      // "all" - show non-archived
      return matchesSearch && !conv.is_archived;
    })
    .sort((a, b) => {
      // Pinned first
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      // Then favorites
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      // Then unread
      const aUnread = a.unread_count ?? 0;
      const bUnread = b.unread_count ?? 0;
      if (aUnread > 0 && bUnread === 0) return -1;
      if (aUnread === 0 && bUnread > 0) return 1;
      // Then by date
      return 0;
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

  // Collapsed view - only avatars
  if (isCollapsed) {
    return (
      <div className="h-full flex flex-col bg-card border-r border-border w-[72px]">
        {/* Collapsed Header */}
        <header className="flex-shrink-0 px-2 py-3 border-b border-border bg-card flex justify-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={onToggleCollapse}
            title="Expandera sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </Button>
        </header>

        {/* Collapsed Conversations - Only avatars */}
        <ScrollArea className="flex-1 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-2">
              {filteredConversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                const hasUnread = (conv.unread_count ?? 0) > 0;
                
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleConversationClick(conv)}
                    className={`relative p-1 rounded-full transition-colors ${
                      isActive ? "ring-2 ring-primary" : "hover:bg-muted"
                    }`}
                    title={getDisplayName(conv)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback
                        className={
                          conv.type === "group"
                            ? "bg-muted text-muted-foreground font-medium text-sm"
                            : "bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground font-medium text-sm"
                        }
                      >
                        {conv.type === "group" ? (
                          <Users className="w-4 h-4" />
                        ) : (
                          getInitials(getDisplayName(conv))
                        )}
                      </AvatarFallback>
                    </Avatar>
                    {/* Unread indicator */}
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
                        {(conv.unread_count ?? 0) > 99 ? "99+" : conv.unread_count}
                      </span>
                    )}
                    {/* Favorite indicator */}
                    {conv.is_favorite && (
                      <span className="absolute -bottom-0.5 -right-0.5">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Collapsed bottom nav */}
        <div className="flex-shrink-0 border-t border-border py-2 flex flex-col items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:bg-muted"
            onClick={() => setNewChatOpen(true)}
            title="Ny chatt"
          >
            <MessageSquare className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="hover:bg-muted" 
            onClick={() => navigate("/admin")}
            title="Inställningar"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
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
  }

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Chats</h1>
          <div className="flex items-center gap-1">
            {onToggleCollapse && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={onToggleCollapse}
                title="Minimera sidebar"
              >
                <PanelLeftClose className="w-5 h-5" />
              </Button>
            )}
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
                      <div className="flex items-center gap-1.5 min-w-0">
                        {conv.is_pinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
                        <span className="font-medium text-foreground truncate">
                          {getDisplayName(conv)}
                        </span>
                        {conv.is_favorite && <Star className="w-3 h-3 text-yellow-500 flex-shrink-0 fill-yellow-500" />}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <CheckCheck className="w-4 h-4 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground truncate flex-1">
                        {conv.last_message || (conv.type === "group" ? "Gruppchatt" : "Ny konversation")}
                      </p>
                      {conv.is_muted && <BellOff className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                      {(conv.unread_count ?? 0) > 0 && (
                        <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 ${
                          conv.is_muted 
                            ? "bg-muted-foreground/30 text-muted-foreground" 
                            : "bg-primary text-primary-foreground"
                        }`}>
                          {(conv.unread_count ?? 0) > 99 ? "99+" : conv.unread_count}
                        </span>
                      )}
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
        <Button 
          variant="ghost" 
          size="icon" 
          className={`hover:bg-muted ${filter === "all" ? "text-primary" : ""}`}
          onClick={() => setFilter("all")}
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`hover:bg-muted ${filter === "favorites" ? "text-primary" : ""}`}
          onClick={() => setFilter("favorites")}
        >
          <Star className={`w-5 h-5 ${filter === "favorites" ? "fill-primary" : ""}`} />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`hover:bg-muted ${filter === "archived" ? "text-primary" : ""}`}
          onClick={() => setFilter("archived")}
        >
          {filter === "archived" ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
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
