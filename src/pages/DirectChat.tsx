import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { useTypingPresence } from "@/hooks/useTypingPresence";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Send, Bot, Loader2, Smile, Paperclip, Mic, Check, CheckCheck } from "lucide-react";
import { MessageBubble, ReplyPreview } from "@/components/MessageBubble";

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
  const { user, profile, loading: authLoading } = useAuth();
  const { streamAIResponse, cancelStream } = useAIChat(id);
  const { typingUsers, handleInputChange, stopTyping } = useTypingPresence(
    id,
    user?.id,
    profile?.display_name || undefined
  );

  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyToMessage | null>(null);

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
    if (!newMessage.trim() || !user || !id || sending) return;

    const content = newMessage.trim();
    const currentReplyTo = replyTo;
    setNewMessage("");
    setReplyTo(null);
    setSending(true);

    try {
      // Insert message with reply_to_id if replying
      const { error } = await supabase.from("messages").insert({
        content,
        is_ai: false,
        user_id: user.id,
        conversation_id: id,
        room_id: id, // Using conversation_id as room_id for compatibility
        reply_to_id: currentReplyTo?.id || null,
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-whatsapp-green" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-whatsapp-chat-bg flex flex-col">
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
              <AvatarFallback className="bg-whatsapp-teal text-white font-medium">
                {conversation?.other_user
                  ? getInitials(conversation.other_user.display_name)
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold truncate">
                {conversation?.other_user?.display_name || "Chatt"}
              </h1>
              <p className="text-xs text-white/70">
                {typingUsers.length > 0 ? "skriver..." : "online"}
              </p>
            </div>
          </div>
        </div>
      </header>

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
                    formatTime={formatMessageTime}
                    onReply={(m) => setReplyTo(m)}
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Smile className="w-6 h-6" />
          </Button>
          
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-muted-foreground hover:text-foreground h-8 w-8"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
          </div>

          {newMessage.trim() ? (
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
  );
};

export default DirectChat;
