import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Users, LogOut, Search, MoreVertical, CheckCheck, Settings, Star, Archive, User, Pin, BellOff, ArchiveRestore, PanelLeftClose, PanelLeft, Bot, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
  type: "direct" | "group" | "ai_chat";
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
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const conversationRefs = useRef<(HTMLButtonElement | null)[]>([]);
  
  // Pull-to-refresh state
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 80;

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

  const fetchConversations = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setIsRefreshing(true);

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
                  display_name: profile.display_name || "User",
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
          // First get all message IDs from this conversation that are from other users
          const { data: otherUsersMessages } = await supabase
            .from("messages")
            .select("id")
            .eq("conversation_id", conv.id)
            .neq("user_id", user.id);

          let unreadCount = 0;
          if (otherUsersMessages && otherUsersMessages.length > 0) {
            const messageIds = otherUsersMessages.map(m => m.id);
            
            // Get read receipts for these messages by current user
            const { data: readReceipts } = await supabase
              .from("message_read_receipts")
              .select("message_id")
              .eq("user_id", user.id)
              .in("message_id", messageIds);

            const readMessageIds = new Set(readReceipts?.map(r => r.message_id) || []);
            unreadCount = messageIds.filter(id => !readMessageIds.has(id)).length;
          }

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
      setIsRefreshing(false);
    }
  }, [user]);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollTop = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  // Track if haptic was already triggered for current pull
  const hapticTriggered = useRef(false);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    const scrollTop = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')?.scrollTop ?? 0;
    if (scrollTop > 0) {
      setIsPulling(false);
      setPullDistance(0);
      hapticTriggered.current = false;
      return;
    }

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, (currentY - pullStartY.current) * 0.5);
    const newDistance = Math.min(distance, PULL_THRESHOLD * 1.5);
    
    // Trigger haptic feedback when threshold is crossed
    if (newDistance >= PULL_THRESHOLD && !hapticTriggered.current) {
      hapticTriggered.current = true;
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } else if (newDistance < PULL_THRESHOLD) {
      hapticTriggered.current = false;
    }
    
    setPullDistance(newDistance);
  }, [isPulling, isRefreshing, PULL_THRESHOLD]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      fetchConversations(true);
    }
    setIsPulling(false);
    setPullDistance(0);
  }, [pullDistance, PULL_THRESHOLD, isRefreshing, fetchConversations]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const getDisplayName = (conv: Conversation) => {
    if (conv.type === "ai_chat") {
      return conv.name || "AI Assistant";
    }
    if (conv.type === "direct") {
      return conv.other_user?.display_name || "User";
    }
    return conv.name || "Group";
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

  const handleConversationClick = useCallback((conv: Conversation) => {
    if (onConversationSelect) {
      onConversationSelect(conv);
    }
    if (conv.type === "direct" || conv.type === "ai_chat") {
      navigate(`/chat/${conv.id}`);
    } else {
      navigate(`/group/${conv.id}`);
    }
  }, [navigate, onConversationSelect]);

  // Keyboard navigation for conversations
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (filteredConversations.length === 0) return;
    
    // Only handle if not typing in an input
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      setFocusedIndex(prev => {
        const newIndex = prev < filteredConversations.length - 1 ? prev + 1 : 0;
        conversationRefs.current[newIndex]?.focus();
        return newIndex;
      });
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      setFocusedIndex(prev => {
        const newIndex = prev > 0 ? prev - 1 : filteredConversations.length - 1;
        conversationRefs.current[newIndex]?.focus();
        return newIndex;
      });
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      const conv = filteredConversations[focusedIndex];
      if (conv) {
        handleConversationClick(conv);
      }
    }
  }, [filteredConversations, focusedIndex, handleConversationClick]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
    }
  };

  return (
    <div className={`h-full flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out overflow-hidden ${isCollapsed ? 'w-[72px] min-w-[72px] max-w-[72px]' : 'w-full min-w-0 max-w-full'}`}>
      {/* Header */}
      <header className={`flex-shrink-0 border-b border-border bg-card transition-all duration-300 ${isCollapsed ? 'px-2 py-3' : 'px-4 py-3'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {/* Title - animated fade */}
          <h1 
            className={`text-xl font-semibold text-foreground transition-all duration-300 overflow-hidden whitespace-nowrap ${
              isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}
          >
            Chats
          </h1>
          <div className={`flex items-center gap-1 ${isCollapsed ? '' : ''}`}>
            {onToggleCollapse && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-foreground hover:bg-muted transition-transform duration-200 hover:scale-105"
                onClick={onToggleCollapse}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <div className="transition-transform duration-300" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <PanelLeftClose className="w-5 h-5" />
                </div>
              </Button>
            )}
            {/* These buttons fade out when collapsed */}
            <div className={`flex items-center gap-1 transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
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
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setNewGroupOpen(true)}>
                    <Users className="w-4 h-4 mr-2" />
                    New group
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Search - slides up and fades out when collapsed */}
      <div 
        className={`flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed ? 'h-0 opacity-0 py-0' : 'h-auto opacity-100 px-3 py-2'
        }`}
      >
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
      <ScrollArea 
        className="flex-1 relative" 
        ref={scrollAreaRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div 
          className={`flex items-center justify-center overflow-hidden transition-all duration-200 ${
            isCollapsed ? 'hidden' : ''
          }`}
          style={{ 
            height: pullDistance > 0 || isRefreshing ? Math.max(pullDistance, isRefreshing ? 48 : 0) : 0,
            opacity: pullDistance > 0 || isRefreshing ? 1 : 0 
          }}
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <RefreshCw 
              className={`w-4 h-4 transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ 
                transform: isRefreshing ? undefined : `rotate(${Math.min(pullDistance / PULL_THRESHOLD * 360, 360)}deg)` 
              }}
            />
            {isRefreshing ? (
              <span>Refreshing...</span>
            ) : pullDistance >= PULL_THRESHOLD ? (
              <span>Release to refresh</span>
            ) : (
              <span>Pull to refresh</span>
            )}
          </div>
        </div>
        
        {loading ? (
          <div className="flex flex-col">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center transition-all duration-300 ${
                  isCollapsed ? 'justify-center px-0 py-2' : 'gap-3 px-4 py-3 border-b border-border/50'
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <Skeleton className={`rounded-full flex-shrink-0 ${isCollapsed ? 'h-10 w-10' : 'h-12 w-12'}`} />
                {!isCollapsed && (
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-3 w-full max-w-[180px]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className={`text-center py-12 px-4 transition-opacity duration-300 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No chats yet</p>
            <Button 
              variant="link" 
              className="text-primary mt-2"
              onClick={() => setNewChatOpen(true)}
            >
              Start a new chat
            </Button>
          </div>
        ) : (
          <div className={`transition-all duration-300 ${isCollapsed ? 'py-2' : ''}`}>
            {filteredConversations.map((conv, index) => {
              const isActive = activeConversationId === conv.id;
              const hasUnread = (conv.unread_count ?? 0) > 0;
              const isFocused = focusedIndex === index;
              
              return (
                <button
                  key={conv.id}
                  ref={(el) => { conversationRefs.current[index] = el; }}
                  onClick={() => handleConversationClick(conv)}
                  onFocus={() => setFocusedIndex(index)}
                  className={`w-full flex items-center transition-all duration-300 ease-in-out text-left outline-none overflow-hidden ${
                    isCollapsed 
                      ? 'justify-center px-0 py-2 hover:bg-muted/50' 
                      : 'gap-3 px-4 py-3 hover:bg-muted/50 border-b border-border/50'
                  } ${isActive ? (isCollapsed ? '' : 'bg-muted') : ''} ${isFocused ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                  title={isCollapsed ? getDisplayName(conv) : undefined}
                  style={{ 
                    animationDelay: `${index * 30}ms`,
                  }}
                >
                  {/* Avatar - always visible */}
                  <div className={`relative flex-shrink-0 transition-all duration-300 ${isCollapsed ? '' : ''}`}>
                    <Avatar className={`transition-all duration-300 ${isCollapsed ? 'h-10 w-10' : 'h-12 w-12'} ${isActive && isCollapsed ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}>
                      <AvatarFallback
                        className={`transition-all duration-300 ${
                          conv.type === "group"
                            ? "bg-muted text-muted-foreground font-medium"
                            : conv.type === "ai_chat"
                            ? "bg-gradient-to-br from-primary to-accent text-primary-foreground font-medium"
                            : "bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground font-medium"
                        } ${isCollapsed ? 'text-sm' : ''}`}
                      >
                        {conv.type === "group" ? (
                          <Users className={`transition-all duration-300 ${isCollapsed ? 'w-4 h-4' : 'w-5 h-5'}`} />
                        ) : conv.type === "ai_chat" ? (
                          <Bot className={`transition-all duration-300 ${isCollapsed ? 'w-4 h-4' : 'w-5 h-5'}`} />
                        ) : (
                          getInitials(getDisplayName(conv))
                        )}
                      </AvatarFallback>
                    </Avatar>
                    {/* Collapsed: Unread indicator */}
                    {isCollapsed && hasUnread && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center animate-scale-in">
                        {(conv.unread_count ?? 0) > 99 ? "99+" : conv.unread_count}
                      </span>
                    )}
                    {/* Collapsed: Favorite indicator */}
                    {isCollapsed && conv.is_favorite && (
                      <span className="absolute -bottom-1 -right-1 animate-scale-in">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      </span>
                    )}
                  </div>

                  {/* Content - fades out when collapsed */}
                  <div 
                    className={`flex-1 overflow-hidden transition-all duration-300 ${
                      isCollapsed ? 'w-0 opacity-0 min-w-0' : 'w-full opacity-100 min-w-0'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {conv.is_pinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
                        <span className="font-medium text-foreground truncate">
                          {getDisplayName(conv)}
                        </span>
                        {conv.is_favorite && <Star className="w-3 h-3 text-yellow-500 flex-shrink-0 fill-yellow-500" />}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 min-w-0 overflow-hidden">
                      <CheckCheck className="w-4 h-4 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground truncate flex-1 min-w-0">
                        {conv.last_message || (conv.type === "group" ? "Gruppchatt" : "Ny konversation")}
                      </p>
                      {conv.is_muted && <BellOff className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                      {hasUnread && (
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

      {/* Bottom nav icons */}
      <div className={`flex-shrink-0 border-t border-border py-2 flex items-center text-muted-foreground transition-all duration-300 ${
        isCollapsed ? 'flex-col gap-1 px-2' : 'justify-around px-4'
      }`}>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`hover:bg-muted transition-all duration-200 hover:scale-105 ${filter === "all" ? "text-primary" : ""}`}
          onClick={() => isCollapsed ? setNewChatOpen(true) : setFilter("all")}
          title={isCollapsed ? "Ny chatt" : "Alla chattar"}
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
        {/* These only show when expanded */}
        <div className={`transition-all duration-300 overflow-hidden ${isCollapsed ? 'h-0 opacity-0' : 'h-auto opacity-100 flex items-center gap-0'}`}>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`hover:bg-muted transition-all duration-200 hover:scale-105 ${filter === "favorites" ? "text-primary" : ""}`}
            onClick={() => setFilter("favorites")}
          >
            <Star className={`w-5 h-5 ${filter === "favorites" ? "fill-primary" : ""}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`hover:bg-muted transition-all duration-200 hover:scale-105 ${filter === "archived" ? "text-primary" : ""}`}
            onClick={() => setFilter("archived")}
          >
            {filter === "archived" ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
          </Button>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="hover:bg-muted transition-all duration-200 hover:scale-105" 
          onClick={() => navigate("/admin")}
          title="Inställningar"
        >
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
