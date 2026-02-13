import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useTypingPresence } from "@/hooks/useTypingPresence";
import { useNotifications } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { VideoSidebar } from "@/components/VideoSidebar";
import { VideoGrid } from "@/components/VideoGrid";
import { ChatMessageList } from "@/components/ChatMessageList";
import { ChatMessageInput } from "@/components/ChatMessageInput";
import { UploadedFile } from "@/components/FileUploadButton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatHeader } from "@/components/ChatHeader";
import { CAGContextBadge } from "@/components/CAGContextBadge";
import { CAGFile, CAGNote } from "@/hooks/useCAGContext";
import { emitBrowserNavigate, emitOpenApp } from "@/lib/canvas-apps/events";
import { Loader2 } from "lucide-react";

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
  sending?: boolean;
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

interface GroupChatProps {
  cagFiles?: CAGFile[];
  cagNotes?: CAGNote[];
  onRemoveCAGFile?: (fileId: string) => void;
  onRemoveCAGNote?: (noteId: string) => void;
  onClearCAG?: () => void;
}

const GroupChat = ({ cagFiles = [], cagNotes = [], onRemoveCAGFile, onRemoveCAGNote, onClearCAG }: GroupChatProps) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { streamAIResponse, cancelStream } = useAIChat(id);
  const { typingUsers, handleInputChange, stopTyping } = useTypingPresence(
    id,
    user?.id,
    profile?.display_name || undefined
  );
  const { showMessageNotification } = useNotifications();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [inCall, setInCall] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyToMessage | null>(null);
  const [pendingFile, setPendingFile] = useState<UploadedFile | null>(null);

  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

      // Subscribe to new messages - directly update state for instant updates
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
            console.log('[GroupChat Realtime] New message received:', newMsg.id);
            
            // Add message to state immediately
            setMessages((prev) => {
              // Skip if already exists (from optimistic update)
              if (prev.find((m) => m.id === newMsg.id)) {
                console.log('[GroupChat Realtime] Skipping duplicate:', newMsg.id);
                return prev;
              }
              // Replace temp message with matching content
              const hasTempMatch = prev.find(
                (m) => m.id.startsWith('temp-') && 
                m.content === newMsg.content && 
                m.user_id === newMsg.user_id
              );
              if (hasTempMatch) {
                console.log('[GroupChat Realtime] Replacing temp message with:', newMsg.id);
                return prev.map((m) => 
                  m.id.startsWith('temp-') && m.content === newMsg.content && m.user_id === newMsg.user_id
                    ? { ...m, id: newMsg.id, sending: false }
                    : m
                );
              }
              
              // Add new message immediately
              console.log('[GroupChat Realtime] Adding new message:', newMsg.id);
              const newMessage: Message = {
                id: newMsg.id,
                content: newMsg.content,
                is_ai: newMsg.is_ai || false,
                user_id: newMsg.user_id,
                created_at: newMsg.created_at,
                reply_to_id: newMsg.reply_to_id,
              };
              return [...prev, newMessage];
            });

            // Enrich with profile info asynchronously (won't block UI)
            if (newMsg.user_id) {
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
                console.log('[GroupChat Realtime] Profile fetch failed:', e);
              }
            }

            // Show notification for messages from others
            if (newMsg.user_id !== user?.id && group) {
              showMessageNotification(
                group.name || "Grupp", 
                newMsg.content, 
                id!, 
                true
              );
            }
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
          display_name: p.display_name || "User",
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
    if ((!newMessage.trim() && !pendingFile) || !user || !id || sending) return;

    const content = pendingFile?.url || newMessage.trim();
    const currentReplyTo = replyTo;
    const currentFile = pendingFile;
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
      sending: true,
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

            // Check for browser navigation command
            let displayText = fullText;
            const browserMatch = fullText.match(/__BROWSER_NAVIGATE__:(.+?)(?:\n|$)/);
            if (browserMatch) {
              const url = browserMatch[1].trim();
              displayText = fullText.replace(/__BROWSER_NAVIGATE__:.+?(?:\n|$)/, '').trim();
              emitBrowserNavigate(url);
              emitOpenApp('browser');
            }

            // Check for code sandbox command
            const codeSandboxMatch = fullText.match(/__CODE_SANDBOX__:({.+?})/);
            if (codeSandboxMatch) {
              try {
                const { code, language, autoRun } = JSON.parse(codeSandboxMatch[1]);
                displayText = displayText.replace(/__CODE_SANDBOX__:{.+?}\s*/g, "").trim();
                const { emitCodeToSandbox } = await import("@/lib/canvas-apps/events");
                emitCodeToSandbox(code, language, autoRun);
                emitOpenApp('code');
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
                emitOpenApp('slides');
              } catch (e) {
                console.error("Failed to parse slides command:", e);
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
                emitOpenApp('whiteboard');
              } catch (e) {
                console.error("Failed to parse whiteboard command:", e);
              }
            }

            await supabase.from("messages").insert({
              content: displayText || fullText,
              is_ai: true,
              user_id: null,
              conversation_id: id,
            });

            await supabase
              .from("conversations")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", id);
          },
          undefined,
          undefined,
          cagFiles,
          cagNotes
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Rollback optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Failed to send message");
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
    <TooltipProvider>
      <div className="min-h-screen bg-background flex">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatHeader
            variant="group"
            conversationId={id || ""}
            userId={user?.id}
            messages={messages}
            typingUsers={typingUsers}
            group={group ? {
              type: "group",
              name: group.name,
              members: members,
            } : null}
            inCall={inCall}
            onJoinCall={handleJoinCall}
            onLeaveCall={handleLeaveCall}
            onHighlightMessage={handleHighlightMessage}
            onDeleted={() => navigate("/chats")}
          />

        {/* Chat Content */}
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
          
          <ChatMessageList
            messages={messages}
            currentUserId={user?.id}
            highlightedMessageId={highlightedMessageId}
            messageRefs={messageRefs}
            messagesEndRef={messagesEndRef}
            onReply={(m) => setReplyTo(m)}
            showSenderNames={true}
            getUserColor={getUserColor}
            aiTyping={aiTyping}
            aiResponse={aiResponse}
            variant="group"
          />

          <ChatMessageInput
            value={newMessage}
            onChange={setNewMessage}
            onSubmit={sendMessage}
            onTyping={handleInputChange}
            onStopTyping={stopTyping}
            sending={sending}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            currentUserId={user?.id}
            pendingFile={pendingFile}
            onFileSelect={(file) => setPendingFile(file)}
            onRemoveFile={() => setPendingFile(null)}
            cagFiles={cagFiles}
            cagNotes={cagNotes}
            onRemoveCAGFile={onRemoveCAGFile}
            onRemoveCAGNote={onRemoveCAGNote}
            onClearCAG={onClearCAG}
            variant="group"
            showAnalyzeHint={true}
          />
        </div>
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
      </div>
    </TooltipProvider>
  );
};

export default GroupChat;
