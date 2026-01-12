import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

interface MessageReactionsProps {
  messageId: string;
  userId: string | undefined;
  isOwn: boolean;
}

const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

export const MessageReactions = ({ messageId, userId, isOwn }: MessageReactionsProps) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const fetchReactions = useCallback(async () => {
    const { data, error } = await supabase
      .from("message_reactions")
      .select("emoji, user_id")
      .eq("message_id", messageId);

    if (error) {
      console.error("Error fetching reactions:", error);
      return;
    }

    // Group reactions by emoji
    const grouped = data.reduce((acc, r) => {
      if (!acc[r.emoji]) {
        acc[r.emoji] = { emoji: r.emoji, count: 0, users: [], hasReacted: false };
      }
      acc[r.emoji].count++;
      acc[r.emoji].users.push(r.user_id);
      if (r.user_id === userId) {
        acc[r.emoji].hasReacted = true;
      }
      return acc;
    }, {} as Record<string, Reaction>);

    setReactions(Object.values(grouped));
  }, [messageId, userId]);

  useEffect(() => {
    fetchReactions();

    // Subscribe to reaction changes
    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `message_id=eq.${messageId}`,
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId, fetchReactions]);

  const toggleReaction = async (emoji: string) => {
    if (!userId) return;

    const existingReaction = reactions.find(r => r.emoji === emoji && r.hasReacted);

    if (existingReaction) {
      // Remove reaction
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId)
        .eq("emoji", emoji);
    } else {
      // Add reaction
      await supabase
        .from("message_reactions")
        .insert({
          message_id: messageId,
          user_id: userId,
          emoji,
        });
    }

    setShowPicker(false);
  };

  if (reactions.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "flex flex-wrap gap-1 mt-1",
      isOwn ? "justify-end" : "justify-start"
    )}>
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => toggleReaction(reaction.emoji)}
          className={cn(
            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors",
            reaction.hasReacted
              ? "bg-whatsapp-green/20 border border-whatsapp-green"
              : "bg-muted/80 hover:bg-muted border border-transparent"
          )}
        >
          <span>{reaction.emoji}</span>
          <span className="text-[10px] text-muted-foreground">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
};

interface ReactionPickerProps {
  messageId: string;
  userId: string | undefined;
  isOwn: boolean;
  children: React.ReactNode;
  onReactionAdded?: () => void;
}

export const ReactionPicker = ({ 
  messageId, 
  userId, 
  isOwn, 
  children,
  onReactionAdded 
}: ReactionPickerProps) => {
  const [open, setOpen] = useState(false);

  const addReaction = async (emoji: string) => {
    if (!userId) return;

    // Check if already reacted with this emoji
    const { data: existing } = await supabase
      .from("message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji)
      .single();

    if (existing) {
      // Remove if exists
      await supabase
        .from("message_reactions")
        .delete()
        .eq("id", existing.id);
    } else {
      // Add reaction
      await supabase
        .from("message_reactions")
        .insert({
          message_id: messageId,
          user_id: userId,
          emoji,
        });
    }

    setOpen(false);
    onReactionAdded?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-2" 
        side={isOwn ? "left" : "right"}
        align="start"
      >
        <div className="flex gap-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => addReaction(emoji)}
              className="text-xl hover:scale-125 transition-transform p-1 hover:bg-muted rounded"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
