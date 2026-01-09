import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Send, Bot, Loader2 } from "lucide-react";

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

interface ConversationInfo {
  id: string;
  type: string;
  other_user?: {
    id: string;
    display_name: string;
  };
}

const DirectChat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { streamAIResponse, cancelStream } = useAIChat(id);

  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [aiResponse, setAiResponse] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchConversation();
      fetchMessages();

      // Subscribe to new messages
      const channel = supabase
        .channel(`chat-${id}`)
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
      };
    }
  }, [user, id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiResponse]);

  const fetchConversation = async () => {
    if (!user || !id) return;

    try {
      const { data: conv, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const convInfo: ConversationInfo = {
        id: conv.id,
        type: conv.type,
      };

      // Get other user for direct chats
      if (conv.type === "direct") {
        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", id)
          .neq("user_id", user.id)
          .single();

        if (members) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .eq("user_id", members.user_id)
            .single();

          if (profile) {
            convInfo.other_user = {
              id: profile.user_id,
              display_name: profile.display_name || "Användare",
            };
          }
        }
      }

      setConversation(convInfo);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      navigate("/chats");
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
      // Insert message
      const { error } = await supabase.from("messages").insert({
        content,
        is_ai: false,
        user_id: user.id,
        conversation_id: id,
        room_id: id, // Using conversation_id as room_id for compatibility
      });

      if (error) throw error;

      // Update conversation last_message_at
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", id);

      // Check if AI should respond
      const isAIMessage = content.toLowerCase().startsWith("@ai") || 
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

            // Save AI response
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/chats")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {conversation?.other_user
                  ? getInitials(conversation.other_user.display_name)
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-semibold text-foreground">
                {conversation?.other_user?.display_name || "Chatt"}
              </h1>
              <p className="text-xs text-muted-foreground">
                Skriv @ai för att prata med AI
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="container mx-auto py-4 space-y-4">
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
        <form onSubmit={sendMessage} className="container mx-auto flex gap-2">
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
    </div>
  );
};

export default DirectChat;
