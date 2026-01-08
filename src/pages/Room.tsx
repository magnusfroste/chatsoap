import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWebRTC } from "@/hooks/useWebRTC";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { VideoSidebar } from "@/components/VideoSidebar";
import { 
  ArrowLeft, 
  Send, 
  Sparkles, 
  Loader2
} from "lucide-react";

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

interface Room {
  id: string;
  name: string;
  description: string | null;
}

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, profile } = useAuth();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isInCall, setIsInCall] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    localStream,
    participants,
    videoEnabled,
    audioEnabled,
    isConnecting,
    toggleVideo,
    toggleAudio,
    joinRoom,
    leaveRoom,
  } = useWebRTC(id, user?.id);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchRoom();
      fetchMessages();
      
      // Subscribe to new messages
      const channel = supabase
        .channel(`room-${id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `room_id=eq.${id}`,
          },
          async (payload) => {
            const newMsg = payload.new as Message;
            // Fetch profile for the new message
            if (newMsg.user_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("display_name")
                .eq("user_id", newMsg.user_id)
                .single();
              newMsg.profile = profile || undefined;
            }
            setMessages((prev) => [...prev, newMsg]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchRoom = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      navigate("/dashboard");
      return;
    }
    
    setRoom(data);
    setLoading(false);
  };

  const fetchMessages = async () => {
    if (!id) return;
    
    const { data: messagesData } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", id)
      .order("created_at", { ascending: true });

    if (messagesData) {
      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(messagesData.filter(m => m.user_id).map(m => m.user_id!))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      const messagesWithProfiles = messagesData.map(msg => ({
        ...msg,
        profile: msg.user_id ? profileMap.get(msg.user_id) : undefined,
      }));
      
      setMessages(messagesWithProfiles);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !id) return;

    setSending(true);
    
    await supabase.from("messages").insert({
      room_id: id,
      user_id: user.id,
      content: newMessage,
      is_ai: false,
    });

    setNewMessage("");
    setSending(false);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-valhalla-deep via-background to-background -z-10" />

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display font-semibold">{room?.name}</h1>
            {room?.description && (
              <p className="text-sm text-muted-foreground">{room.description}</p>
            )}
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* AI Workspace - Center */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-2">
                    Välkommen till AI-arbetsytan
                  </h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Börja skriva för att starta konversationen. Alla i rummet kan se och bidra.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.is_ai ? "flex-row" : "flex-row"}`}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className={msg.is_ai ? "bg-primary text-primary-foreground" : "bg-secondary"}>
                        {msg.is_ai ? "AI" : getInitials(msg.profile?.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {msg.is_ai ? "AI Assistant" : msg.profile?.display_name || "Anonym"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString("sv-SE", { 
                            hour: "2-digit", 
                            minute: "2-digit" 
                          })}
                        </span>
                      </div>
                      <div className={`rounded-lg p-3 ${
                        msg.is_ai 
                          ? "bg-primary/10 border border-primary/20" 
                          : "bg-card border border-border"
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border/50 p-4 bg-background/80 backdrop-blur-sm">
            <form onSubmit={sendMessage} className="max-w-3xl mx-auto flex gap-2">
              <Input
                placeholder="Skriv till rummet eller AI..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1"
                disabled={sending}
              />
              <Button 
                type="submit" 
                className="gradient-valhalla hover:opacity-90"
                disabled={sending || !newMessage.trim()}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Video sidebar - Right */}
        <VideoSidebar
          localStream={localStream}
          participants={participants}
          videoEnabled={videoEnabled}
          audioEnabled={audioEnabled}
          isConnecting={isConnecting}
          isInCall={isInCall}
          displayName={profile?.display_name}
          onToggleVideo={toggleVideo}
          onToggleAudio={toggleAudio}
          onJoinCall={async () => {
            await joinRoom(true, true);
            setIsInCall(true);
          }}
          onLeaveCall={async () => {
            await leaveRoom();
            setIsInCall(false);
          }}
        />
      </div>
    </div>
  );
}
