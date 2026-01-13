import { useState } from "react";
import { Bot, Check, CheckCheck, Reply, X } from "lucide-react";
import { MessageReactions, ReactionPicker } from "./MessageReactions";
import { cn } from "@/lib/utils";

interface ReplyToMessage {
  id: string;
  content: string;
  user_id: string | null;
  is_ai: boolean;
  profile?: {
    display_name: string | null;
  };
}

interface MessageBubbleProps {
  message: {
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
  };
  isOwn: boolean;
  userId: string | undefined;
  showSenderName?: boolean;
  getUserColor?: (userId: string) => string;
  formatTime: (dateStr: string) => string;
  onReply?: (message: { id: string; content: string; user_id: string | null; is_ai: boolean; profile?: { display_name: string | null } }) => void;
  isRead?: boolean;
}

export const MessageBubble = ({
  message,
  isOwn,
  userId,
  showSenderName = false,
  getUserColor,
  formatTime,
  onReply,
  isRead,
}: MessageBubbleProps) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const isAI = message.is_ai;

  const handleLongPress = () => {
    setShowReactionPicker(true);
  };

  const handleReply = () => {
    if (onReply) {
      onReply({
        id: message.id,
        content: message.content,
        user_id: message.user_id,
        is_ai: message.is_ai,
        profile: message.profile,
      });
    }
    setShowReactionPicker(false);
  };

  const getReplyPreview = (content: string) => {
    return content.length > 60 ? content.substring(0, 60) + "..." : content;
  };

  const getReplyUserName = () => {
    if (message.reply_to?.is_ai) return "AI Assistent";
    if (message.reply_to?.user_id === userId) return "Du";
    return message.reply_to?.profile?.display_name || "Användare";
  };

  const bubbleContent = (
    <div
      className={cn(
        "relative max-w-[85%] sm:max-w-[70%] rounded-lg px-3 py-2 shadow-sm select-none",
        isAI
          ? "bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700/50"
          : isOwn
          ? "bg-whatsapp-light-green dark:bg-whatsapp-green-dark text-foreground"
          : "bg-white dark:bg-card text-foreground"
      )}
      style={{
        borderTopLeftRadius: !isOwn && !isAI ? "4px" : undefined,
        borderTopRightRadius: isOwn ? "4px" : undefined,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
      onTouchStart={(e) => {
        const timeout = setTimeout(() => {
          handleLongPress();
        }, 500);
        (e.target as HTMLElement).dataset.pressTimeout = String(timeout);
      }}
      onTouchEnd={(e) => {
        const timeout = (e.target as HTMLElement).dataset.pressTimeout;
        if (timeout) {
          clearTimeout(Number(timeout));
        }
      }}
      onTouchMove={(e) => {
        const timeout = (e.target as HTMLElement).dataset.pressTimeout;
        if (timeout) {
          clearTimeout(Number(timeout));
        }
      }}
    >
      {/* Reply quote */}
      {message.reply_to && (
        <div 
          className={cn(
            "mb-2 p-2 rounded border-l-4 bg-black/5 dark:bg-white/5",
            message.reply_to.is_ai
              ? "border-l-purple-500"
              : message.reply_to.user_id === userId
              ? "border-l-whatsapp-green"
              : "border-l-blue-500"
          )}
        >
          <p className={cn(
            "text-xs font-semibold",
            message.reply_to.is_ai
              ? "text-purple-600 dark:text-purple-400"
              : message.reply_to.user_id === userId
              ? "text-whatsapp-green"
              : "text-blue-600 dark:text-blue-400"
          )}>
            {getReplyUserName()}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {getReplyPreview(message.reply_to.content)}
          </p>
        </div>
      )}

      {/* Sender name for group chats */}
      {showSenderName && message.user_id && getUserColor && (
        <p className={cn(
          "text-xs font-semibold mb-0.5",
          getUserColor(message.user_id).replace("bg-", "text-")
        )}>
          {message.profile?.display_name || "Användare"}
        </p>
      )}

      {/* AI Badge */}
      {isAI && (
        <div className="flex items-center gap-1.5 mb-1 text-purple-600 dark:text-purple-400">
          <Bot className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">AI Assistent</span>
        </div>
      )}

      {/* Message Content */}
      <p className="whitespace-pre-wrap text-sm leading-relaxed break-words">
        {message.content}
      </p>

      {/* Time and Read Status */}
      <div className={cn(
        "flex items-center justify-end gap-1 mt-1",
        isAI ? "text-purple-500" : "text-muted-foreground"
      )}>
        <span className="text-[10px]">
          {formatTime(message.created_at)}
        </span>
        {isOwn && !message.is_ai && (
          isRead ? (
            <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
          ) : (
            <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
          )
        )}
      </div>

      {/* Message tail */}
      <div
        className={cn(
          "absolute top-0 w-3 h-3 overflow-hidden",
          isOwn ? "-right-1.5" : "-left-1.5"
        )}
      >
        <div
          className={cn(
            "w-3 h-3 transform rotate-45",
            isAI
              ? "bg-purple-100 dark:bg-purple-900/30"
              : isOwn
              ? "bg-whatsapp-light-green dark:bg-whatsapp-green-dark"
              : "bg-white dark:bg-card"
          )}
          style={{
            marginLeft: isOwn ? "-6px" : "6px",
            marginTop: "2px",
          }}
        />
      </div>
    </div>
  );

  return (
    <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
      <div className={cn("flex", isOwn ? "justify-end" : "justify-start", "mb-0.5")}>
        <ReactionPicker
          messageId={message.id}
          userId={userId}
          isOwn={isOwn}
          onReactionAdded={() => setShowReactionPicker(false)}
          onReply={onReply ? handleReply : undefined}
        >
          <div className="cursor-pointer">
            {bubbleContent}
          </div>
        </ReactionPicker>
      </div>
      
      {/* Reactions */}
      <div className={cn("max-w-[85%] sm:max-w-[70%]", isOwn ? "pr-0" : "pl-0")}>
        <MessageReactions
          messageId={message.id}
          userId={userId}
          isOwn={isOwn}
        />
      </div>
    </div>
  );
};

// Reply preview bar component for use in chat input
interface ReplyPreviewProps {
  replyTo: {
    id: string;
    content: string;
    user_id: string | null;
    is_ai: boolean;
    profile?: {
      display_name: string | null;
    };
  };
  currentUserId?: string;
  onCancel: () => void;
}

export const ReplyPreview = ({ replyTo, currentUserId, onCancel }: ReplyPreviewProps) => {
  const getUserName = () => {
    if (replyTo.is_ai) return "AI Assistent";
    if (replyTo.user_id === currentUserId) return "Du";
    return replyTo.profile?.display_name || "Användare";
  };

  const getPreview = (content: string) => {
    return content.length > 80 ? content.substring(0, 80) + "..." : content;
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 border-l-4 border-l-whatsapp-green rounded-t-lg">
      <Reply className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs font-semibold",
          replyTo.is_ai
            ? "text-purple-600 dark:text-purple-400"
            : replyTo.user_id === currentUserId
            ? "text-whatsapp-green"
            : "text-blue-600 dark:text-blue-400"
        )}>
          {getUserName()}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {getPreview(replyTo.content)}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="p-1 hover:bg-muted rounded-full transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
};
