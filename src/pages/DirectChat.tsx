import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { useTypingPresence } from "@/hooks/useTypingPresence";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { useDirectCall } from "@/hooks/useDirectCall";
import { useNotifications } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Mic } from "lucide-react";
import { ReplyPreview } from "@/components/MessageBubble";
import { ChatMessageList } from "@/components/ChatMessageList";
import { CallUI } from "@/components/CallUI";
import { FloatingVideoCall } from "@/components/FloatingVideoCall";
import { EmojiPicker } from "@/components/EmojiPicker";
import { FileUploadButton, FilePreview, UploadedFile } from "@/components/FileUploadButton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatHeader } from "@/components/ChatHeader";
import { AI_PERSONAS } from "@/components/PersonaSwitcher";
import { CAGContextBadge } from "@/components/CAGContextBadge";
import { CAGFile, CAGNote } from "@/hooks/useCAGContext";
import { emitBrowserNavigate, emitOpenApp, emitCreateNote } from "@/lib/canvas-apps";
import { toast } from "@/hooks/use-toast";

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

interface DirectChatProps {
  cagFiles?: CAGFile[];
  cagNotes?: CAGNote[];
  onRemoveCAGFile?: (fileId: string) => void;
  onRemoveCAGNote?: (noteId: string) => void;
  onClearCAG?: () => void;
}

const DirectChat = ({ cagFiles = [], cagNotes = [], onRemoveCAGFile, onRemoveCAGNote, onClearCAG }: DirectChatProps) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { streamAIResponse, cancelStream } = useAIChat(id);
  const { typingUsers, handleInputChange, stopTyping } = useTypingPresence(
    id,
    user?.id,
    profile?.display_name || undefined
  );
  const { isMessageRead, markMessagesAsRead } = useReadReceipts(id, user?.id);
  const { showMessageNotification } = useNotifications();

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

  // Refetch messages when tab becomes visible (handles browser throttling)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && id) {
        console.log('[Visibility] Tab became visible, refetching messages');
        fetchMessages();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, id]);

  useEffect(() => {
    if (user && id) {
      fetchConversation();
      fetchMessages();
    }
  }, [user, id]);

  // Realtime subscription - directly update state for instant updates
  useEffect(() => {
    if (!user?.id || !id) return;
    
    // Use a simpler, unique channel name to avoid binding conflicts
    const channelName = `messages-${id}-${user.id}-${Date.now()}`;
    console.log('[DirectChat Realtime] Setting up channel:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const newMsg = payload.new as any;
          
          // Filter client-side to avoid binding issues
          if (newMsg.conversation_id !== id) {
            return;
          }
          
          console.log('[DirectChat Realtime] New message received:', newMsg.id, 'from user:', newMsg.user_id);
          
          // Add message to state immediately, then enrich async
          setMessages((prev) => {
            // Skip if already exists (from optimistic update)
            if (prev.find((m) => m.id === newMsg.id)) {
              console.log('[DirectChat Realtime] Skipping duplicate:', newMsg.id);
              return prev;
            }
            // Replace temp message with matching content
            const hasTempMatch = prev.find(
              (m) => m.id.startsWith('temp-') && 
              m.content === newMsg.content && 
              m.user_id === newMsg.user_id
            );
            if (hasTempMatch) {
              console.log('[DirectChat Realtime] Replacing temp message with:', newMsg.id);
              return prev.map((m) => 
                m.id.startsWith('temp-') && m.content === newMsg.content && m.user_id === newMsg.user_id
                  ? { ...m, id: newMsg.id, sending: false }
                  : m
              );
            }
            
            // Add new message immediately (basic info)
            console.log('[DirectChat Realtime] Adding new message:', newMsg.id);
            const newMessage: Message = {
              id: newMsg.id,
              content: newMsg.content,
              is_ai: newMsg.is_ai || false,
              user_id: newMsg.user_id,
              created_at: newMsg.created_at,
              reply_to_id: newMsg.reply_to_id,
              attachment_type: newMsg.attachment_type,
              attachment_name: newMsg.attachment_name,
            };
            return [...prev, newMessage];
          });
          
          // Enrich with profile info asynchronously (won't block UI)
          if (newMsg.user_id && newMsg.user_id !== user.id) {
            try {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("display_name")
                .eq("user_id", newMsg.user_id)
                .single();
              
              if (profileData) {
                setMessages((prev) => 
                  prev.map((m) => 
                    m.id === newMsg.id 
                      ? { ...m, profile: profileData }
                      : m
                  )
                );
              }
            } catch (e) {
              console.log('[DirectChat Realtime] Profile fetch failed:', e);
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[DirectChat Realtime] Subscription status:', status, err ? `Error: ${err}` : '');
        if (status === 'SUBSCRIBED') {
          console.log('[DirectChat Realtime] Successfully subscribed to channel');
        }
      });

    return () => {
      console.log('[DirectChat Realtime] Removing channel:', channelName);
      supabase.removeChannel(channel);
      cancelStream();
    };
  }, [user?.id, id, cancelStream]);

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

      // Check if this is an AI message trigger
      const isAIMessage = messageText.toLowerCase().startsWith("@ai") || 
                          messageText.toLowerCase().startsWith("/ai");
      
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

            // Check for browser navigate command from AI tools
            let displayText = fullText;
            const browserNavMatch = fullText.match(/__BROWSER_NAVIGATE__:([^\s]+)/);
            if (browserNavMatch) {
              const url = browserNavMatch[1];
              displayText = fullText.replace(/__BROWSER_NAVIGATE__:[^\s]+\s*/g, "").trim();
              emitBrowserNavigate(url);
              emitOpenApp("browser");
            }

            // Check for code sandbox command from AI tools
            const codeSandboxMatch = fullText.match(/__CODE_SANDBOX__:({.+?})/);
            if (codeSandboxMatch) {
              try {
                const { code, language, autoRun } = JSON.parse(codeSandboxMatch[1]);
                displayText = displayText.replace(/__CODE_SANDBOX__:{.+?}\s*/g, "").trim();
                const { emitCodeToSandbox } = await import("@/lib/canvas-apps/events");
                emitCodeToSandbox(code, language, autoRun);
                emitOpenApp("code");
              } catch (e) {
                console.error("Failed to parse code sandbox command:", e);
              }
            }

            // Check for slides update command from AI tools
            const slidesMatch = fullText.match(/__SLIDES_UPDATE__:({.+})/s);
            if (slidesMatch) {
              try {
                const { slides, title, theme } = JSON.parse(slidesMatch[1]);
                displayText = displayText.replace(/__SLIDES_UPDATE__:{.+}/s, "").trim();
                const { emitSlidesUpdate } = await import("@/lib/canvas-apps/events");
                emitSlidesUpdate(slides, title, theme);
                emitOpenApp("slides");
              } catch (e) {
                console.error("Failed to parse slides command:", e);
              }
            }

            // Check for spreadsheet update command from AI tools
            const spreadsheetMarker = "__SPREADSHEET_UPDATE__:";
            const spreadsheetIndex = fullText.indexOf(spreadsheetMarker);
            if (spreadsheetIndex !== -1) {
              try {
                const jsonStart = spreadsheetIndex + spreadsheetMarker.length;
                // Find the matching closing brace
                let braceCount = 0;
                let jsonEnd = jsonStart;
                for (let i = jsonStart; i < fullText.length; i++) {
                  if (fullText[i] === "{") braceCount++;
                  else if (fullText[i] === "}") {
                    braceCount--;
                    if (braceCount === 0) {
                      jsonEnd = i + 1;
                      break;
                    }
                  }
                }
                const jsonStr = fullText.slice(jsonStart, jsonEnd);
                const { updates, description } = JSON.parse(jsonStr);
                displayText = displayText.replace(spreadsheetMarker + jsonStr, "").trim();
                if (!displayText && description) {
                  displayText = `📊 ${description}`;
                }
                const { emitSpreadsheetUpdate } = await import("@/lib/canvas-apps/events");
                emitSpreadsheetUpdate(updates, description);
                emitOpenApp("spreadsheet");
              } catch (e) {
                console.error("Failed to parse spreadsheet command:", e);
              }
            }

            // Check for whiteboard shapes command from AI tools
            const whiteboardMarker = "__WHITEBOARD_SHAPES__:";
            const whiteboardIndex = fullText.indexOf(whiteboardMarker);
            if (whiteboardIndex !== -1) {
              try {
                const jsonStart = whiteboardIndex + whiteboardMarker.length;
                let braceCount = 0;
                let jsonEnd = jsonStart;
                for (let i = jsonStart; i < fullText.length; i++) {
                  if (fullText[i] === "{") braceCount++;
                  else if (fullText[i] === "}") {
                    braceCount--;
                    if (braceCount === 0) {
                      jsonEnd = i + 1;
                      break;
                    }
                  }
                }
                const jsonStr = fullText.slice(jsonStart, jsonEnd);
                const { shapes, description } = JSON.parse(jsonStr);
                displayText = displayText.replace(whiteboardMarker + jsonStr, "").trim();
                if (!displayText && description) {
                  displayText = `🎨 ${description}`;
                }
                const { emitWhiteboardShapes } = await import("@/lib/canvas-apps/events");
                emitWhiteboardShapes(shapes, description);
                emitOpenApp("whiteboard");
              } catch (e) {
                console.error("Failed to parse whiteboard command:", e);
              }
            }

            const aiTempId = `ai-temp-${Date.now()}`;
            const optimisticAiMessage: Message = {
              id: aiTempId,
              content: displayText || "Opening website in browser...",
              is_ai: true,
              user_id: null,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, optimisticAiMessage]);

            const { data: aiMsg } = await supabase.from("messages").insert({
              content: displayText || "Opening website in browser...",
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
          conversation?.customSystemPrompt || undefined,
          cagFiles,
          cagNotes
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

  const handleSaveToNotes = async (content: string, messageId: string) => {
    const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
    emitCreateNote(content, title);
    toast({
      title: "Sparat till anteckningar",
      description: "Meddelandet har sparats som en ny anteckning.",
    });
  };

  const handleSaveDocumentToNotes = async (title: string, content: string) => {
    emitCreateNote(content, title);
    toast({
      title: "Sparat till anteckningar",
      description: "Dokumentet har sparats som en ny anteckning.",
    });
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
      {/* Incoming call - still use full overlay */}
      {callState.status === "ringing" && callState.isIncoming && (
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

      {/* Active video call - floating panel */}
      {callState.status !== "idle" && 
       !(callState.status === "ringing" && callState.isIncoming) && 
       (callState.callType === "video" || videoEnabled) && (
        <FloatingVideoCall
          status={callState.status}
          callType={callState.callType}
          remoteUserName={callState.remoteUserName}
          localStream={localStream}
          remoteStream={remoteStream}
          screenStream={screenStream}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          isScreenSharing={isScreenSharing}
          onEnd={endCall}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
        />
      )}

      <div className="h-full flex bg-background">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatHeader
            variant="direct"
            conversationId={id || ""}
            userId={user?.id}
            messages={messages}
            typingUsers={typingUsers}
            aiTyping={aiTyping}
            conversation={conversation ? {
              type: conversation.type as "direct" | "ai_chat",
              persona: conversation.persona,
              personaName: conversation.personaName,
              customSystemPrompt: conversation.customSystemPrompt,
              other_user: conversation.other_user,
            } : null}
            callState={{
              status: callState.status,
              callType: callState.callType,
              isIncoming: callState.isIncoming,
              remoteUserName: callState.remoteUserName,
            }}
            localStream={localStream}
            remoteStream={remoteStream}
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            onStartCall={startCall}
            onEndCall={endCall}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onPersonaChange={(persona, customSystemPrompt) => {
              setConversation(prev => prev ? { 
                ...prev, 
                persona,
                customSystemPrompt: customSystemPrompt || null 
              } : null);
            }}
            onHighlightMessage={handleHighlightMessage}
            onDeleted={() => navigate("/chats")}
          />

          <ChatMessageList
            messages={messages}
            currentUserId={user?.id}
            highlightedMessageId={highlightedMessageId}
            messageRefs={messageRefs}
            messagesEndRef={messagesEndRef}
            onReply={(m) => setReplyTo(m)}
            isMessageRead={isMessageRead}
            onSaveToNotes={handleSaveToNotes}
            typingUsers={typingUsers}
            aiTyping={aiTyping}
            aiResponse={aiResponse}
            variant="direct"
          />

          {/* Message Input */}
          <div className="flex-shrink-0 bg-card border-t border-border px-2 sm:px-3 py-2">
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

            {/* CAG Context Badge */}
            {(cagFiles.length > 0 || cagNotes.length > 0) && onRemoveCAGFile && onClearCAG && (
              <div className="max-w-4xl mx-auto mb-2">
                <CAGContextBadge 
                  files={cagFiles} 
                  notes={cagNotes}
                  onRemoveFile={onRemoveCAGFile} 
                  onRemoveNote={onRemoveCAGNote}
                  onClearAll={onClearCAG} 
                />
              </div>
            )}
            
            <form onSubmit={sendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
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
                  placeholder={
                    cagFiles.length > 0
                      ? `Ask about your ${cagFiles.length} file${cagFiles.length > 1 ? 's' : ''}...`
                      : conversation?.type === "ai_chat"
                        ? "Write a message to AI..."
                        : "Write a message"
                  }
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
      </div>
    </TooltipProvider>
  );
};

export default DirectChat;
