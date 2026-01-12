import { useState } from "react";
import { Bot, CheckCheck } from "lucide-react";
import { MessageReactions, ReactionPicker } from "./MessageReactions";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    is_ai: boolean;
    user_id: string | null;
    created_at: string;
    profile?: {
      display_name: string | null;
    };
  };
  isOwn: boolean;
  userId: string | undefined;
  showSenderName?: boolean;
  getUserColor?: (userId: string) => string;
  formatTime: (dateStr: string) => string;
}

export const MessageBubble = ({
  message,
  isOwn,
  userId,
  showSenderName = false,
  getUserColor,
  formatTime,
}: MessageBubbleProps) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const isAI = message.is_ai;

  const handleLongPress = () => {
    setShowReactionPicker(true);
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
        {isOwn && (
          <CheckCheck className="w-3.5 h-3.5 text-whatsapp-green" />
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
