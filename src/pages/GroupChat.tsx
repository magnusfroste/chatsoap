import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { useWebRTC } from "@/hooks/useWebRTC";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoSidebar } from "@/components/VideoSidebar";
import {
  ArrowLeft,
  Send,
  Bot,
  Loader2,
  MessageSquare,
  PenTool,
  Users,
} from "lucide-react";

const CollaborativeCanvas = lazy(() => 
  import("@/components/CollaborativeCanvas").then(mod => ({ default: mod.CollaborativeCanvas }))
);

interface Message {
  id: string;
  content: string;
  is_ai: boolean;
  user_id: string | null;
  created_at: string;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    localStream,
    participants,
    audioEnabled,
    videoEnabled,
    isConnecting,
    toggleAudio,
    toggleVideo,
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
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages((prev) => {
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
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
        .select("id, content, is_ai, user_id, created_at, conversation_id")
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

      const enrichedMessages: Message[] = (data || []).map((msg) => ({
        id: msg.id,
        content: msg.content,
        is_ai: msg.is_ai || false,
        user_id: msg.user_id,
        created_at: msg.created_at,
        profile: msg.user_id ? profileMap.get(msg.user_id) : undefined,
      }));

      setMessages(enrichedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !id || sending) return;

    const content = newMessage.trim();
    setNewMessage("");
    setSending(true);

    try {
      const { error } = await supabase.from("messages").insert({
        content,
        is_ai: false,
        user_id: user.id,
        conversation_id: id,
        room_id: id,
      });

      if (error) throw error;

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
              room_id: id,
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
    await joinRoom(true, true);
    setInCall(true);
  };

  const handleLeaveCall = async () => {
    await leaveRoom();
    setInCall(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/chats")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Users className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold text-foreground truncate">
                  {group?.name || "Grupp"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {members.length} medlemmar
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-2 w-fit">
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Chatt
            </TabsTrigger>
            <TabsTrigger value="whiteboard" className="gap-2">
              <PenTool className="w-4 h-4" />
              Whiteboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="py-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.user_id === user?.id ? "flex-row-reverse" : ""
                    }`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback
                        className={
                          msg.is_ai
                            ? "bg-primary text-primary-foreground"
                            : msg.user_id === user?.id
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {msg.is_ai ? (
                          <Bot className="w-4 h-4" />
                        ) : (
                          getInitials(
                            msg.profile?.display_name ||
                              (msg.user_id === user?.id ? "Du" : "?")
                          )
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        msg.is_ai
                          ? "bg-primary/10 text-foreground"
                          : msg.user_id === user?.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.user_id !== user?.id && !msg.is_ai && (
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {msg.profile?.display_name || "Användare"}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {/* AI typing indicator */}
                {aiTyping && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="max-w-[70%] rounded-2xl px-4 py-2 bg-primary/10 text-foreground">
                      <p className="whitespace-pre-wrap">
                        {aiResponse || (
                          <span className="flex gap-1">
                            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100" />
                            <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200" />
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Skriv ett meddelande..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="whiteboard" className="flex-1 mt-0 data-[state=inactive]:hidden">
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              }
            >
              <CollaborativeCanvas roomId={id || ""} userId={user?.id || ""} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      {/* Video Sidebar */}
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
    </div>
  );
};

export default GroupChat;
