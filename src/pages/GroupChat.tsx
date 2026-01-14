import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useTypingPresence } from "@/hooks/useTypingPresence";
import { useNotes, Note } from "@/hooks/useNotes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoSidebar } from "@/components/VideoSidebar";
import { VideoGrid } from "@/components/VideoGrid";
import { MessageBubble, ReplyPreview } from "@/components/MessageBubble";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ImageUploadButton, ImagePreview } from "@/components/ImageUploadButton";
import { NotesSidebar } from "@/components/NotesSidebar";
import { NoteEditor } from "@/components/NoteEditor";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Send,
  Bot,
  Loader2,
  MessageSquare,
  PenTool,
  Users,
  Mic,
  CheckCheck,
  Video,
  MoreVertical,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import { ChatActionsMenu } from "@/components/ChatActionsMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CollaborativeCanvas = lazy(() => 
  import("@/components/CollaborativeCanvas").then(mod => ({ default: mod.CollaborativeCanvas }))
);

const GroupWhiteboardWrapper = lazy(() =>
  import("@/components/GroupWhiteboardWrapper").then(mod => ({ default: mod.GroupWhiteboardWrapper }))
);

interface ReplyToMessage {
  id: string;
  content: string;
  user_id: string | null;
  is_ai: boolean;
  profile?: {
    display_name: string | null;
  };
}

interface Message {
  id: string;
  content: string;
  is_ai: boolean;
  user_id: string | null;
  created_at: string;
  reply_to_id?: string | null;
  reply_to?: ReplyToMessage | null;
  profile?: {
    display_name: string | null;
  };
}

interface GroupInfo {
  id: string;
  name: string | null;
  type: string;
  created_by: string;
}

interface Member {
  user_id: string;
  display_name: string;
}

const GroupChat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { streamAIResponse, cancelStream } = useAIChat(id);
  const { typingUsers, handleInputChange, stopTyping } = useTypingPresence(
    id,
    user?.id,
    profile?.display_name || undefined
  );

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [inCall, setInCall] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyToMessage | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  // Notes
  const { notes, isLoading: notesLoading, createNote, updateNote, deleteNote } = useNotes(user?.id);
  const [notesSidebarOpen, setNotesSidebarOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    localStream,
    screenStream,
    participants,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    isConnecting,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    joinRoom,
    leaveRoom,
  } = useWebRTC(id, user?.id);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchGroup();
      fetchMembers();
      fetchMessages();

      // Subscribe to new messages
      const channel = supabase
        .channel(`group-${id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${id}`,
          },
          async (payload) => {
            const newMsg = payload.new as any;
            
            // Skip if message already exists (from optimistic update or duplicate)
            setMessages((prev) => {
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              // Skip temp messages - they'll be replaced by real ones
              if (prev.find((m) => m.id.startsWith('temp-') && m.content === newMsg.content && m.user_id === newMsg.user_id)) {
                return prev;
              }
              return prev;
            });

            // Fetch profile for the new message if it has a user_id
            let msgProfile = undefined;
            if (newMsg.user_id) {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("display_name")
                .eq("user_id", newMsg.user_id)
                .single();
              msgProfile = profileData || undefined;
            }

            // Fetch reply_to if exists
            let reply_to = undefined;
            if (newMsg.reply_to_id) {
              const { data: replyData } = await supabase
                .from("messages")
                .select("id, content, user_id, is_ai")
                .eq("id", newMsg.reply_to_id)
                .single();
              
              if (replyData) {
                let replyProfile = undefined;
                if (replyData.user_id) {
                  const { data: rp } = await supabase
                    .from("profiles")
                    .select("display_name")
                    .eq("user_id", replyData.user_id)
                    .single();
                  replyProfile = rp || undefined;
                }
                reply_to = { ...replyData, profile: replyProfile };
              }
            }

            const enrichedMessage: Message = {
              id: newMsg.id,
              content: newMsg.content,
              is_ai: newMsg.is_ai || false,
              user_id: newMsg.user_id,
              created_at: newMsg.created_at,
              reply_to_id: newMsg.reply_to_id,
              reply_to,
              profile: msgProfile,
            };

            setMessages((prev) => {
              // Skip if already exists
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              // Filter out temp messages that match this real message
              const filtered = prev.filter(m => 
                !(m.id.startsWith('temp-') && m.content === newMsg.content && m.user_id === newMsg.user_id)
              );
              return [...filtered, enrichedMessage];
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        cancelStream();
        if (inCall) leaveRoom();
      };
    }
  }, [user, id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiResponse]);

  const fetchGroup = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setGroup(data);
    } catch (error) {
      console.error("Error fetching group:", error);
      navigate("/chats");
    }
  };

  const fetchMembers = async () => {
    if (!id) return;

    try {
      const { data: memberData, error: memberError } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", id);

      if (memberError) throw memberError;

      const userIds = memberData?.map((m) => m.user_id) || [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      setMembers(
        profiles?.map((p) => ({
          user_id: p.user_id,
          display_name: p.display_name || "Användare",
        })) || []
      );
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const fetchMessages = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, is_ai, user_id, created_at, conversation_id, reply_to_id")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch profiles for user messages
      const userIds = [...new Set(data?.filter((m) => m.user_id).map((m) => m.user_id))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      // Create a map of messages for reply lookups
      const messageMap = new Map<string, Message>();
      
      const enrichedMessages: Message[] = (data || []).map((msg) => {
        const enriched: Message = {
          id: msg.id,
          content: msg.content,
          is_ai: msg.is_ai || false,
          user_id: msg.user_id,
          created_at: msg.created_at,
          reply_to_id: msg.reply_to_id,
          profile: msg.user_id ? profileMap.get(msg.user_id) : undefined,
        };
        messageMap.set(msg.id, enriched);
        return enriched;
      });

      // Add reply_to references
      enrichedMessages.forEach((msg) => {
        if (msg.reply_to_id && messageMap.has(msg.reply_to_id)) {
          const replyMsg = messageMap.get(msg.reply_to_id)!;
          msg.reply_to = {
            id: replyMsg.id,
            content: replyMsg.content,
            user_id: replyMsg.user_id,
            is_ai: replyMsg.is_ai,
            profile: replyMsg.profile,
          };
        }
      });

      setMessages(enrichedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !pendingImage) || !user || !id || sending) return;

    const content = pendingImage || newMessage.trim();
    const currentReplyTo = replyTo;
    setNewMessage("");
    setReplyTo(null);
    setPendingImage(null);
    setSending(true);

    // Create optimistic message to show immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      content,
      is_ai: false,
      user_id: user.id,
      created_at: new Date().toISOString(),
      reply_to_id: currentReplyTo?.id || null,
      reply_to: currentReplyTo,
      profile: { display_name: profile?.display_name || null },
    };

    // Add message to UI immediately (optimistic update)
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const { data: insertedMsg, error } = await supabase.from("messages").insert({
        content,
        is_ai: false,
        user_id: user.id,
        conversation_id: id,
        reply_to_id: currentReplyTo?.id || null,
      }).select().single();

      if (error) throw error;

      // Replace temp message with real one (with correct ID)
      if (insertedMsg) {
        setMessages((prev) => 
          prev.map((m) => m.id === tempId ? { ...optimisticMessage, id: insertedMsg.id } : m)
        );
      }

      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", id);

      // Check if AI should respond
      const isAIMessage =
        content.toLowerCase().startsWith("@ai") ||
        content.toLowerCase().startsWith("/ai");

      if (isAIMessage) {
        setAiTyping(true);
        setAiResponse("");

        const recentMessages: Message[] = messages.slice(-10).map((m) => ({
          id: m.id,
          content: m.content,
          is_ai: m.is_ai,
          user_id: m.user_id,
          created_at: m.created_at,
          profile: m.profile,
        }));

        recentMessages.push({
          id: "temp",
          content,
          is_ai: false,
          user_id: user.id,
          created_at: new Date().toISOString(),
        });

        await streamAIResponse(
          recentMessages,
          (delta) => {
            setAiResponse((prev) => prev + delta);
          },
          async (fullText) => {
            setAiTyping(false);
            setAiResponse("");

            await supabase.from("messages").insert({
              content: fullText,
              is_ai: true,
              user_id: null,
              conversation_id: id,
            });

            await supabase
              .from("conversations")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", id);
          }
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleJoinCall = async () => {
    if (!id || !user || !group) return;
    
    // Ensure a room exists for this conversation (for WebRTC presence/signals)
    const { data: existingRoom } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", id)
      .single();
    
    if (!existingRoom) {
      // Create a room with the same ID as the conversation
      await supabase.from("rooms").insert({
        id: id,
        name: group.name || "Gruppsamtal",
        created_by: user.id,
      });
    }
    
    // Ensure user is a room member
    const { data: existingMember } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", id)
      .eq("user_id", user.id)
      .single();
    
    if (!existingMember) {
      await supabase.from("room_members").insert({
        room_id: id,
        user_id: user.id,
      });
    }
    
    await joinRoom(true, true);
    setInCall(true);
  };

  const handleLeaveCall = async () => {
    await leaveRoom();
    setInCall(false);
  };

  // Notes handlers
  const handleNoteSelect = (note: Note) => {
    setSelectedNote(note);
    setNoteEditorOpen(true);
  };

  const handleCreateNote = async () => {
    const newNote = await createNote({
      title: "New Note",
      content: "",
      conversationId: id,
    });
    if (newNote) {
      setSelectedNote(newNote);
      setNoteEditorOpen(true);
    }
  };

  const handleSaveToNotes = async (content: string, messageId: string) => {
    const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
    await createNote({
      title,
      content,
      conversationId: id,
      sourceMessageId: messageId,
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Idag";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Igår";
    } else {
      return date.toLocaleDateString("sv-SE", { 
        weekday: "long", 
        day: "numeric", 
        month: "long" 
      });
    }
  };

  const shouldShowDateSeparator = (currentMsg: Message, prevMsg?: Message) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.created_at).toDateString();
    const prevDate = new Date(prevMsg.created_at).toDateString();
    return currentDate !== prevDate;
  };

  // Generate a consistent color for each user
  const getUserColor = (userId: string) => {
    const colors = [
      "bg-orange-500",
      "bg-pink-500", 
      "bg-blue-500",
      "bg-purple-500",
      "bg-cyan-500",
      "bg-amber-500",
      "bg-rose-500",
      "bg-indigo-500",
    ];
    const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-whatsapp-green" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* WhatsApp-style Header */}
        <header className="bg-whatsapp-green text-white sticky top-0 z-10 shadow-md">
          <div className="px-2 py-2">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/chats")}
                className="text-white hover:bg-whatsapp-green-dark"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="h-10 w-10 ring-2 ring-white/20">
                <AvatarFallback className="bg-whatsapp-teal text-white">
                  <Users className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold truncate">
                  {group?.name || "Grupp"}
                </h1>
                <p className="text-xs text-white/70 truncate">
                  {typingUsers.length > 0 
                    ? `${typingUsers.map(u => u.display_name).join(", ")} skriver...`
                    : members.map(m => m.display_name).join(", ")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-whatsapp-green-dark"
                onClick={inCall ? handleLeaveCall : handleJoinCall}
              >
                <Video className={`w-5 h-5 ${inCall ? "text-red-300" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-whatsapp-green-dark"
                onClick={() => setNotesSidebarOpen(!notesSidebarOpen)}
              >
                {notesSidebarOpen ? (
                  <PanelRightClose className="w-5 h-5" />
                ) : (
                  <PanelRightOpen className="w-5 h-5" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-whatsapp-green-dark">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setActiveTab("whiteboard")}>
                    <PenTool className="w-4 h-4 mr-2" />
                    Öppna Whiteboard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex border-t border-white/10">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === "chat" 
                  ? "text-white border-b-2 border-white" 
                  : "text-white/60 hover:text-white/80"
              }`}
            >
              <MessageSquare className="w-4 h-4 inline-block mr-1.5" />
              CHATT
            </button>
            <button
              onClick={() => setActiveTab("whiteboard")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === "whiteboard" 
                  ? "text-white border-b-2 border-white" 
                  : "text-white/60 hover:text-white/80"
              }`}
            >
              <PenTool className="w-4 h-4 inline-block mr-1.5" />
              WHITEBOARD
            </button>
          </div>
        </header>

        {/* Content */}
        {activeTab === "chat" ? (
          <div className="flex-1 flex flex-col bg-whatsapp-chat-bg overflow-hidden">
            {/* Video Grid when in call */}
            {inCall && (
              <div className="p-3 border-b border-border/50 bg-background/95">
                <VideoGrid
                  localStream={localStream}
                  screenStream={screenStream}
                  participants={participants}
                  videoEnabled={videoEnabled}
                  audioEnabled={audioEnabled}
                  isScreenSharing={isScreenSharing}
                  displayName={profile?.display_name}
                  onToggleVideo={toggleVideo}
                  onToggleAudio={toggleAudio}
                  onToggleScreenShare={toggleScreenShare}
                  onLeaveCall={handleLeaveCall}
                />
              </div>
            )}
            
            {/* Messages with WhatsApp pattern background */}
            {/* Messages with WhatsApp pattern background */}
            <ScrollArea className="flex-1">
              <div 
                className="min-h-full px-3 py-2"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2325D366' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              >
                <div className="max-w-3xl mx-auto space-y-1">
                  {messages.map((msg, index) => {
                    const prevMsg = index > 0 ? messages[index - 1] : undefined;
                    const showDateSeparator = shouldShowDateSeparator(msg, prevMsg);
                    const isOwn = msg.user_id === user?.id;
                    const isAI = msg.is_ai;
                    const showSender = !isOwn && !isAI && (
                      !prevMsg || 
                      prevMsg.user_id !== msg.user_id || 
                      showDateSeparator
                    );

                    return (
                      <div key={msg.id}>
                        {/* Date Separator */}
                        {showDateSeparator && (
                          <div className="flex justify-center my-3">
                            <span className="bg-white/90 dark:bg-card/90 text-muted-foreground text-xs px-3 py-1 rounded-lg shadow-sm">
                              {formatDateSeparator(msg.created_at)}
                            </span>
                          </div>
                        )}

                        {/* Message Bubble */}
                        <MessageBubble
                          message={msg}
                          isOwn={isOwn}
                          userId={user?.id}
                          showSenderName={showSender}
                          getUserColor={getUserColor}
                          formatTime={formatMessageTime}
                          onReply={(m) => setReplyTo(m)}
                          onSaveToNotes={(content, messageId) => handleSaveToNotes(content, messageId)}
                        />
                      </div>
                    );
                  })}

                  {/* AI typing indicator */}
                  {aiTyping && (
                    <div className="flex justify-start mb-1">
                      <div className="relative max-w-[85%] sm:max-w-[70%] rounded-lg px-3 py-2 shadow-sm bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700/50">
                        <div className="flex items-center gap-1.5 mb-1 text-purple-600 dark:text-purple-400">
                          <Bot className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">AI Assistent</span>
                        </div>
                        {aiResponse ? (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{aiResponse}</p>
                        ) : (
                          <div className="flex gap-1 py-1">
                            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>
            </ScrollArea>

            {/* WhatsApp-style Message Input */}
            <div className="bg-whatsapp-chat-bg border-t border-border/50 p-2">
              {/* Image preview */}
              {pendingImage && (
                <div className="max-w-3xl mx-auto mb-3">
                  <ImagePreview imageUrl={pendingImage} onRemove={() => setPendingImage(null)} />
                </div>
              )}
              
              {/* Reply preview */}
              {replyTo && (
                <div className="max-w-3xl mx-auto mb-2">
                  <ReplyPreview 
                    replyTo={replyTo} 
                    currentUserId={user?.id} 
                    onCancel={() => setReplyTo(null)} 
                  />
                </div>
              )}
              
              <form onSubmit={sendMessage} className="flex items-center gap-2 max-w-3xl mx-auto">
                <EmojiPicker 
                  onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)} 
                />
                
                <div className="flex-1 flex items-center bg-white dark:bg-card rounded-full px-4 py-2 shadow-sm">
                  <Input
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleInputChange();
                    }}
                    onBlur={stopTyping}
                    placeholder="Meddelande"
                    className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-sm"
                    disabled={sending}
                  />
                  <ImageUploadButton 
                    onImageSelect={(url) => setPendingImage(url)} 
                    className="h-8 w-8"
                  />
                </div>

                {(newMessage.trim() || pendingImage) ? (
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={sending}
                    className="flex-shrink-0 rounded-full w-12 h-12 bg-whatsapp-green hover:bg-whatsapp-green-dark shadow-md"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    size="icon"
                    className="flex-shrink-0 rounded-full w-12 h-12 bg-whatsapp-green hover:bg-whatsapp-green-dark shadow-md"
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                )}
              </form>

              {/* AI hint */}
              <p className="text-center text-xs text-muted-foreground mt-2">
                Skriv <span className="font-medium text-whatsapp-green">@ai</span> för att prata med AI-assistenten
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-whatsapp-green" />
                </div>
              }
            >
              <GroupWhiteboardWrapper 
                conversationId={id || ""} 
                userId={user?.id || ""} 
                groupName={group?.name || "Grupp"}
              />
            </Suspense>
          </div>
        )}
      </div>

      {/* Video Sidebar */}
      {inCall && (
        <VideoSidebar
          localStream={localStream}
          participants={participants}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          isConnecting={isConnecting}
          isInCall={inCall}
          displayName={profile?.display_name}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onJoinCall={handleJoinCall}
          onLeaveCall={handleLeaveCall}
        />
      )}

      {/* Notes Sidebar */}
      <NotesSidebar
        notes={notes}
        isLoading={notesLoading}
        isOpen={notesSidebarOpen}
        onClose={() => setNotesSidebarOpen(false)}
        onNoteSelect={handleNoteSelect}
        onCreateNote={handleCreateNote}
      />

      {/* Note Editor Dialog */}
      <NoteEditor
        note={selectedNote}
        isOpen={noteEditorOpen}
        onClose={() => {
          setNoteEditorOpen(false);
          setSelectedNote(null);
        }}
        onSave={async (noteId, updates) => {
          const updated = await updateNote(noteId, updates);
          if (updated) setSelectedNote(updated);
          return updated;
        }}
        onDelete={deleteNote}
      />
    </div>
  );
};

export default GroupChat;
