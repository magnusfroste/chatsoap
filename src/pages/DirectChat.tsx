import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { useDocumentAI } from "@/hooks/useDocumentAI";
import { useTypingPresence } from "@/hooks/useTypingPresence";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { useDirectCall } from "@/hooks/useDirectCall";
import { useNotes, Note } from "@/hooks/useNotes";
import { useNotifications } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Send, Bot, Loader2, Mic, Check, CheckCheck, Search, Phone, Video, FileText, PanelRightOpen, PanelRightClose, Images } from "lucide-react";
import { ChatActionsMenu } from "@/components/ChatActionsMenu";
import { MessageBubble, ReplyPreview } from "@/components/MessageBubble";
import { CallUI } from "@/components/CallUI";
import { EmojiPicker } from "@/components/EmojiPicker";
import { FileUploadButton, FilePreview, UploadedFile } from "@/components/FileUploadButton";
import { DocumentPreview } from "@/components/DocumentPreview";
import { NotesSidebar } from "@/components/NotesSidebar";
import { NoteEditor } from "@/components/NoteEditor";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatMessageSearch } from "@/components/ChatMessageSearch";
import { PersonaSwitcher, AI_PERSONAS } from "@/components/PersonaSwitcher";
import { ChatMediaLibrary } from "@/components/ChatMediaLibrary";
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
  attachment_type?: string | null;
  attachment_name?: string | null;
  sending?: boolean;
  profile?: {
    display_name: string | null;
  };
}

interface ConversationInfo {
  id: string;
  type: string;
  persona?: string | null;
  personaName?: string | null;
  customSystemPrompt?: string | null;
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
  const { analyzeDocument, cancelAnalysis } = useDocumentAI();
  const { typingUsers, handleInputChange, stopTyping } = useTypingPresence(
    id,
    user?.id,
    profile?.display_name || undefined
  );
  const { isMessageRead, markMessagesAsRead } = useReadReceipts(id, user?.id);
  const { showMessageNotification } = useNotifications();
  
  // Notes
  const { notes, isLoading: notesLoading, createNote, updateNote, deleteNote } = useNotes(user?.id);
  const [notesSidebarOpen, setNotesSidebarOpen] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);

  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyToMessage | null>(null);
  const [pendingFile, setPendingFile] = useState<UploadedFile | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [analyzingDocument, setAnalyzingDocument] = useState<{ url: string; name: string; mimeType: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Direct call hook
  const {
    callState,
    localStream,
    remoteStream,
    screenStream,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useDirectCall(
    id,
    user?.id,
    conversation?.other_user?.id,
    conversation?.other_user?.display_name
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchConversation();
      fetchMessages();

      // Subscribe to new messages with realtime
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
          async (payload) => {
            const newMsg = payload.new as any;
            
            // Skip if this exact message already exists
            setMessages((prev) => {
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              return prev;
            });

            // Fetch profile for the new message if it has a user_id
            let profile = undefined;
            if (newMsg.user_id) {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("display_name")
                .eq("user_id", newMsg.user_id)
                .single();
              profile = profileData || undefined;
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
              profile,
            };

            setMessages((prev) => {
              // Skip if already exists with this ID
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              // Filter out matching temp messages and add the real one
              const filtered = prev.filter(m => 
                !(m.id.startsWith('temp-') && m.content === newMsg.content && m.user_id === newMsg.user_id) &&
                !(m.id.startsWith('ai-temp-') && m.content === newMsg.content && m.is_ai)
              );
              return [...filtered, enrichedMessage];
            });

            // Show notification for messages from others
            if (newMsg.user_id !== user?.id && profile) {
              const senderName = profile.display_name || "Någon";
              showMessageNotification(senderName, newMsg.content, id!, false);
            }
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

  // Scroll to highlighted message
  useEffect(() => {
    if (highlightedMessageId) {
      const element = messageRefs.current.get(highlightedMessageId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightedMessageId]);

  // Handler for search highlight
  const handleHighlightMessage = useCallback((messageId: string | null) => {
    setHighlightedMessageId(messageId);
  }, []);

  // Mark incoming messages as read when viewing the chat
  useEffect(() => {
    if (!user || !messages.length) return;
    
    // Find messages from other users that need to be marked as read
    const unreadMessageIds = messages
      .filter((m) => m.user_id !== user.id && m.user_id !== null && !m.id.startsWith('temp-'))
      .map((m) => m.id);
    
    if (unreadMessageIds.length > 0) {
      markMessagesAsRead(unreadMessageIds);
    }
  }, [messages, user, markMessagesAsRead]);

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
        persona: conv.persona,
        personaName: null,
        customSystemPrompt: null,
      };

      // If using a custom persona, fetch its details
      if (conv.persona?.startsWith("custom:")) {
        const customPersonaId = conv.persona.replace("custom:", "");
        const { data: customPersona } = await supabase
          .from("custom_personas")
          .select("system_prompt, name")
          .eq("id", customPersonaId)
          .single();
        
        if (customPersona) {
          convInfo.customSystemPrompt = customPersona.system_prompt;
          convInfo.personaName = customPersona.name;
        }
      } else if (conv.persona) {
        // Built-in persona
        const builtIn = AI_PERSONAS.find(p => p.id === conv.persona);
        if (builtIn) {
          convInfo.personaName = builtIn.name;
        }
      }

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
    if ((!newMessage.trim() && !pendingFile) || !user || !id || sending) return;

    const messageText = newMessage.trim();
    const currentFile = pendingFile;
    const currentReplyTo = replyTo;
    
    // Determine content: if we have a file, store both file URL and message
    // If file + text, we send file URL as content and text separately
    const content = currentFile ? currentFile.url : messageText;
    
    setNewMessage("");
    setReplyTo(null);
    setPendingFile(null);
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
      attachment_type: currentFile?.type || null,
      attachment_name: currentFile?.name || null,
      sending: true,
      profile: { display_name: profile?.display_name || null },
    };

    // Add message to UI immediately (optimistic update)
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      // Insert file message first if we have a file
      const { data: insertedMsg, error } = await supabase.from("messages").insert({
        content,
        is_ai: false,
        user_id: user.id,
        conversation_id: id,
        reply_to_id: currentReplyTo?.id || null,
        attachment_type: currentFile?.type || null,
        attachment_name: currentFile?.name || null,
      }).select().single();

      if (error) throw error;

      // Replace temp message with real one (with correct ID, no longer sending)
      if (insertedMsg) {
        setMessages((prev) => 
          prev.map((m) => m.id === tempId ? { ...optimisticMessage, id: insertedMsg.id, sending: false } : m)
        );
      }

      // If we have both file and text with @ai, send the text as a separate message and trigger analysis
      const isAIMessage = messageText.toLowerCase().startsWith("@ai") || 
                          messageText.toLowerCase().startsWith("/ai");
      
      // If file + @ai message, send text message and analyze document
      if (currentFile && messageText && isAIMessage) {
        // Insert the text question as a separate message
        const textTempId = `temp-text-${Date.now()}`;
        const textMessage: Message = {
          id: textTempId,
          content: messageText,
          is_ai: false,
          user_id: user.id,
          created_at: new Date().toISOString(),
          profile: { display_name: profile?.display_name || null },
        };
        setMessages((prev) => [...prev, textMessage]);

        const { data: textMsgData } = await supabase.from("messages").insert({
          content: messageText,
          is_ai: false,
          user_id: user.id,
          conversation_id: id,
        }).select().single();

        if (textMsgData) {
          setMessages((prev) => 
            prev.map((m) => m.id === textTempId ? { ...textMessage, id: textMsgData.id } : m)
          );
        }

        // Now analyze the document with the question
        setAiTyping(true);
        setAiResponse("");

        const question = messageText.replace(/^[@/]ai\s*/i, "").trim() || "Sammanfatta detta dokument";
        
        const recentMessages = messages.slice(-5).map((m) => ({
          content: m.content,
          is_ai: m.is_ai,
          display_name: m.profile?.display_name || "Användare",
        }));

        await analyzeDocument(
          {
            url: currentFile.url,
            name: currentFile.name,
            mimeType: currentFile.mimeType,
          },
          question,
          recentMessages,
          (delta) => {
            setAiResponse((prev) => prev + delta);
          },
          async (fullText) => {
            setAiTyping(false);
            setAiResponse("");

            const aiTempId = `ai-temp-${Date.now()}`;
            const optimisticAiMessage: Message = {
              id: aiTempId,
              content: fullText,
              is_ai: true,
              user_id: null,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, optimisticAiMessage]);

            const { data: aiMsg } = await supabase.from("messages").insert({
              content: fullText,
              is_ai: true,
              user_id: null,
              conversation_id: id,
            }).select().single();

            if (aiMsg) {
              setMessages((prev) => 
                prev.map((m) => m.id === aiTempId ? { ...optimisticAiMessage, id: aiMsg.id } : m)
              );
            }

            await supabase
              .from("conversations")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", id);
          }
        );
      } 
      // Regular @ai message without document OR AI-chat auto-response
      const isAIChat = conversation?.type === "ai_chat";
      const triggerAI = (isAIMessage && !currentFile) || (isAIChat && !currentFile);
      
      if (triggerAI) {
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
          id: insertedMsg?.id || tempId,
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

            const aiTempId = `ai-temp-${Date.now()}`;
            const optimisticAiMessage: Message = {
              id: aiTempId,
              content: fullText,
              is_ai: true,
              user_id: null,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, optimisticAiMessage]);

            const { data: aiMsg } = await supabase.from("messages").insert({
              content: fullText,
              is_ai: true,
              user_id: null,
              conversation_id: id,
            }).select().single();

            if (aiMsg) {
              setMessages((prev) => 
                prev.map((m) => m.id === aiTempId ? { ...optimisticAiMessage, id: aiMsg.id } : m)
              );
            }

            await supabase
              .from("conversations")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", id);
          },
          conversation?.persona || undefined,
          conversation?.customSystemPrompt || undefined
        );
      }

      // Update conversation last_message_at
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", id);

    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // Handler for analyzing document from message bubble
  const handleAnalyzeFromMessage = useCallback((url: string, name: string, mimeType: string) => {
    setPendingFile({ url, name, type: mimeType.includes("pdf") ? "pdf" : "document", mimeType });
    setNewMessage("@ai ");
  }, []);

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

  const handleSaveToNotes = async (content: string, messageId: string) => {
    const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
    await createNote({
      title,
      content,
      conversationId: id,
      sourceMessageId: messageId,
    });
  };

  const handleSaveDocumentToNotes = async (title: string, content: string) => {
    await createNote({
      title,
      content,
      conversationId: id,
    });
  };

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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-whatsapp-green" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      {/* Call UI Overlay */}
      {callState.status !== "idle" && (
        <CallUI
          status={callState.status}
          callType={callState.callType}
          isIncoming={callState.isIncoming}
          remoteUserName={callState.remoteUserName}
          localStream={localStream}
          remoteStream={remoteStream}
          screenStream={screenStream}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          isScreenSharing={isScreenSharing}
          onAccept={acceptCall}
          onDecline={declineCall}
          onEnd={endCall}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
        />
      )}

      <div className="h-full flex bg-background">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header - WhatsApp desktop style */}
          <header className="flex-shrink-0 bg-card border-b border-border px-4 py-2">
            <div className="flex items-center gap-3">
              {/* Mobile back button */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/chats")}
                className="md:hidden text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <Avatar className="h-10 w-10">
                <AvatarFallback className={`font-medium ${
                  conversation?.type === "ai_chat" 
                    ? "bg-gradient-to-br from-primary to-accent text-primary-foreground"
                    : "bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground"
                }`}>
                  {conversation?.type === "ai_chat" ? (
                    <Bot className="w-5 h-5" />
                  ) : conversation?.other_user ? (
                    getInitials(conversation.other_user.display_name)
                  ) : "?"}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold text-foreground truncate">
                    {conversation?.type === "ai_chat" 
                      ? (conversation.personaName || AI_PERSONAS.find(p => p.id === conversation.persona)?.name || "AI Assistent")
                      : conversation?.other_user?.display_name || "Chatt"}
                  </h1>
                  {conversation?.type === "ai_chat" && (
                    <PersonaSwitcher 
                      conversationId={id || ""}
                      currentPersona={conversation.persona}
                      onPersonaChange={(persona, customSystemPrompt) => {
                        setConversation(prev => prev ? { 
                          ...prev, 
                          persona,
                          customSystemPrompt: customSystemPrompt || null 
                        } : null);
                      }}
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {conversation?.type === "ai_chat" 
                    ? (aiTyping ? "skriver..." : "redo att hjälpa")
                    : (typingUsers.length > 0 ? "skriver..." : "online")}
                </p>
              </div>

              {/* Action icons - Call buttons (hidden for AI chat) */}
              <div className="flex items-center gap-1">
                {conversation?.type !== "ai_chat" && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => startCall("video")}
                      disabled={callState.status !== "idle"}
                    >
                      <Video className="w-5 h-5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => startCall("audio")}
                      disabled={callState.status !== "idle"}
                    >
                      <Phone className="w-5 h-5" />
                    </Button>
                  </>
                )}
                <ChatMessageSearch
                  messages={messages}
                  onHighlightMessage={handleHighlightMessage}
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setMediaLibraryOpen(true)}
                >
                  <Images className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setNotesSidebarOpen(!notesSidebarOpen)}
                >
                  {notesSidebarOpen ? (
                    <PanelRightClose className="w-5 h-5" />
                  ) : (
                    <PanelRightOpen className="w-5 h-5" />
                  )}
                </Button>
                <ChatActionsMenu
                  conversationId={id || ""}
                  userId={user?.id}
                  chatName={conversation?.other_user?.display_name || "Chatt"}
                  onDeleted={() => navigate("/chats")}
                />
              </div>
            </div>
          </header>

          {/* Messages area with subtle pattern */}
          <ScrollArea className="flex-1 bg-muted/30">
            <div 
              className="min-h-full px-4 py-3"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              <div className="max-w-4xl mx-auto space-y-1">
                {messages.map((msg, index) => {
                  const prevMsg = index > 0 ? messages[index - 1] : undefined;
                  const showDateSeparator = shouldShowDateSeparator(msg, prevMsg);
                  const isOwn = msg.user_id === user?.id;
                  const isAI = msg.is_ai;

                  return (
                    <div 
                      key={msg.id} 
                      className="group"
                      ref={(el) => {
                        if (el) messageRefs.current.set(msg.id, el);
                      }}
                    >
                      {/* Date Separator */}
                      {showDateSeparator && (
                        <div className="flex justify-center my-4">
                          <span className="bg-card text-muted-foreground text-xs px-3 py-1.5 rounded-lg shadow-sm">
                            {formatDateSeparator(msg.created_at)}
                          </span>
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div className={highlightedMessageId === msg.id ? "ring-2 ring-primary rounded-lg transition-all duration-300" : ""}>
                        <MessageBubble
                          message={msg}
                          isOwn={isOwn}
                          userId={user?.id}
                          formatTime={formatMessageTime}
                          onReply={(m) => setReplyTo(m)}
                          isRead={isOwn ? isMessageRead(msg.id, msg.user_id) : undefined}
                          onSaveToNotes={handleSaveToNotes}
                          onAnalyzeDocument={handleAnalyzeFromMessage}
                          onSaveDocumentToNotes={handleSaveDocumentToNotes}
                        />
                      </div>
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

          {/* Message Input */}
          <div className="flex-shrink-0 bg-card border-t border-border px-4 py-3">
            {/* File preview */}
            {pendingFile && (
              <div className="max-w-4xl mx-auto mb-3">
                <FilePreview 
                  file={pendingFile} 
                  onRemove={() => setPendingFile(null)} 
                  showAnalyzeHint={pendingFile.type !== "image"}
                />
              </div>
            )}
            
            {/* Reply preview */}
            {replyTo && (
              <div className="max-w-4xl mx-auto mb-2">
                <ReplyPreview 
                  replyTo={replyTo} 
                  currentUserId={user?.id} 
                  onCancel={() => setReplyTo(null)} 
                />
              </div>
            )}
            
            <form onSubmit={sendMessage} className="flex items-center gap-3 max-w-4xl mx-auto">
              <EmojiPicker 
                onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)} 
              />
              
              <FileUploadButton 
                onFileSelect={(file) => setPendingFile(file)} 
              />
              
              <div className="flex-1">
                <Input
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleInputChange();
                  }}
                  onBlur={stopTyping}
                  placeholder={conversation?.type === "ai_chat" ? "Write a message to AI..." : "Write a message"}
                  className="bg-muted/50 border-0 rounded-lg h-10 focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={sending}
                />
              </div>

              {(newMessage.trim() || pendingFile) ? (
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={sending}
                  className="flex-shrink-0 rounded-full w-10 h-10 bg-primary hover:bg-primary/90"
                >
                  <Send className="w-5 h-5" />
                </Button>
              ) : (
                <Button 
                  type="button" 
                  size="icon"
                  className="flex-shrink-0 rounded-full w-10 h-10 bg-primary hover:bg-primary/90"
                >
                  <Mic className="w-5 h-5" />
                </Button>
              )}
            </form>

            {/* AI hint - only show for non-AI chats */}
            {conversation?.type !== "ai_chat" && (
              <p className="text-center text-xs text-muted-foreground mt-2 max-w-4xl mx-auto">
                Type <span className="font-medium text-primary">@ai</span> to chat with AI
                {pendingFile && pendingFile.type !== "image" && (
                  <span> • Attach document + @ai to analyze</span>
                )}
              </p>
            )}
            {conversation?.type === "ai_chat" && pendingFile && pendingFile.type !== "image" && (
              <p className="text-center text-xs text-muted-foreground mt-2 max-w-4xl mx-auto">
                Type a question to analyze the document
              </p>
            )}
          </div>
        </div>

        {/* Notes Sidebar */}
        <NotesSidebar
          notes={notes}
          isLoading={notesLoading}
          isOpen={notesSidebarOpen}
          onClose={() => setNotesSidebarOpen(false)}
          onNoteSelect={handleNoteSelect}
          onCreateNote={handleCreateNote}
        />

        {/* Media Library */}
        <ChatMediaLibrary
          open={mediaLibraryOpen}
          onOpenChange={setMediaLibraryOpen}
          conversationId={id || ""}
          onAnalyze={(url, name, mimeType) => {
            setAnalyzingDocument({ url, name, mimeType });
            setNewMessage("@ai ");
          }}
          onSaveToNotes={handleSaveDocumentToNotes}
        />
      </div>

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
        userId={user?.id}
      />
    </TooltipProvider>
  );
};

export default DirectChat;
