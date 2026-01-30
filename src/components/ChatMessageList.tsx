import { useRef, useEffect, MutableRefObject } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/MessageBubble";
import { Bot } from "lucide-react";

interface TypingUser {
  id: string;
  display_name: string;
}

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
  attachment_type?: string | null;
  attachment_name?: string | null;
  profile?: {
    display_name: string | null;
  };
}

interface ChatMessageListProps {
  messages: Message[];
  currentUserId: string | undefined;
  highlightedMessageId: string | null;
  messageRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  messagesEndRef: MutableRefObject<HTMLDivElement | null>;
  onReply: (message: ReplyToMessage) => void;
  // Direct chat specific
  isMessageRead?: (messageId: string, userId: string | null) => boolean;
  onSaveToNotes?: (content: string, messageId: string) => void;
  // Group chat specific
  showSenderNames?: boolean;
  getUserColor?: (userId: string) => string;
  // Typing indicators
  typingUsers?: TypingUser[];
  aiTyping?: boolean;
  aiResponse?: string;
  // Styling
  variant?: "direct" | "group";
}

// Helper functions
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

// Background patterns
const directChatPattern = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;

const groupChatPattern = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2325D366' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;

export const ChatMessageList = ({
  messages,
  currentUserId,
  highlightedMessageId,
  messageRefs,
  messagesEndRef,
  onReply,
  isMessageRead,
  onSaveToNotes,
  showSenderNames = false,
  getUserColor,
  typingUsers = [],
  aiTyping = false,
  aiResponse = "",
  variant = "direct",
}: ChatMessageListProps) => {
  // Scroll to highlighted message
  useEffect(() => {
    if (highlightedMessageId) {
      const element = messageRefs.current.get(highlightedMessageId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightedMessageId, messageRefs]);

  const isGroup = variant === "group";
  const maxWidth = isGroup ? "max-w-3xl" : "max-w-4xl";
  const spacing = isGroup ? "space-y-1" : "space-y-0.5";

  return (
    <ScrollArea className={`flex-1 ${isGroup ? "" : "bg-muted/30"}`}>
      <div 
        className={`min-h-full ${isGroup ? "px-3" : "px-2 sm:px-3"} py-2`}
        style={{
          backgroundImage: isGroup ? groupChatPattern : directChatPattern,
        }}
      >
        <div className={`${maxWidth} mx-auto ${spacing}`}>
          {messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : undefined;
            const showDateSeparator = shouldShowDateSeparator(msg, prevMsg);
            const isOwn = msg.user_id === currentUserId;
            const isAI = msg.is_ai;
            
            // For group chats, determine if we should show sender name
            const showSender = showSenderNames && !isOwn && !isAI && (
              !prevMsg || 
              prevMsg.user_id !== msg.user_id || 
              showDateSeparator
            );

            return (
              <div 
                key={msg.id}
                className={isGroup ? "" : "group"}
                ref={(el) => {
                  if (el) messageRefs.current.set(msg.id, el);
                }}
              >
                {/* Date Separator */}
                {showDateSeparator && (
                  <div className={`flex justify-center ${isGroup ? "my-3" : "my-4"}`}>
                    <span className={`${isGroup ? "bg-white/90 dark:bg-card/90" : "bg-card"} text-muted-foreground text-xs px-3 py-1.5 rounded-lg shadow-sm`}>
                      {formatDateSeparator(msg.created_at)}
                    </span>
                  </div>
                )}

                {/* Message Bubble */}
                <div className={highlightedMessageId === msg.id ? "ring-2 ring-primary rounded-lg transition-all duration-300" : ""}>
                  <MessageBubble
                    message={msg}
                    isOwn={isOwn}
                    userId={currentUserId}
                    showSenderName={showSender}
                    getUserColor={getUserColor}
                    formatTime={formatMessageTime}
                    onReply={onReply}
                    isRead={isOwn && isMessageRead ? isMessageRead(msg.id, msg.user_id) : undefined}
                    onSaveToNotes={onSaveToNotes}
                  />
                </div>
              </div>
            );
          })}

          {/* User typing indicator (direct chat only) */}
          {typingUsers.length > 0 && variant === "direct" && (
            <div className="flex justify-start mb-1">
              <div className="relative max-w-[90%] sm:max-w-[75%] rounded-lg px-2.5 py-1.5 shadow-sm bg-muted/60">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {typingUsers.map(u => u.display_name).join(", ")} skriver...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* AI typing indicator */}
          {aiTyping && (
            <div className="flex justify-start mb-1">
              <div className={`relative ${isGroup ? "max-w-[85%] sm:max-w-[70%] px-3 py-2" : "max-w-[90%] sm:max-w-[75%] px-2.5 py-1.5"} rounded-lg shadow-sm bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700/50`}>
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
  );
};
