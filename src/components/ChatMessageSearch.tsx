import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  is_ai: boolean;
  profile?: {
    display_name: string | null;
  };
}

interface ChatMessageSearchProps {
  messages: Message[];
  onHighlightMessage: (messageId: string | null) => void;
  className?: string;
}

export const ChatMessageSearch = ({
  messages,
  onHighlightMessage,
  className,
}: ChatMessageSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchedMessages, setMatchedMessages] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter messages based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchedMessages([]);
      setCurrentIndex(0);
      onHighlightMessage(null);
      return;
    }

    const query = searchQuery.toLowerCase();
    const matched = messages.filter(
      (m) =>
        m.content.toLowerCase().includes(query) &&
        !m.id.startsWith("temp-") &&
        !m.id.startsWith("ai-temp-")
    );
    
    setMatchedMessages(matched);
    setCurrentIndex(matched.length > 0 ? 0 : -1);

    if (matched.length > 0) {
      onHighlightMessage(matched[0].id);
    } else {
      onHighlightMessage(null);
    }
  }, [searchQuery, messages, onHighlightMessage]);

  // Navigate to previous match
  const goToPrevious = useCallback(() => {
    if (matchedMessages.length === 0) return;
    const newIndex = currentIndex === 0 ? matchedMessages.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
    onHighlightMessage(matchedMessages[newIndex].id);
  }, [matchedMessages, currentIndex, onHighlightMessage]);

  // Navigate to next match
  const goToNext = useCallback(() => {
    if (matchedMessages.length === 0) return;
    const newIndex = currentIndex === matchedMessages.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
    onHighlightMessage(matchedMessages[newIndex].id);
  }, [matchedMessages, currentIndex, onHighlightMessage]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevious();
        } else {
          goToNext();
        }
      } else if (e.key === "Escape") {
        handleClose();
      }
    },
    [goToNext, goToPrevious]
  );

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery("");
    setMatchedMessages([]);
    setCurrentIndex(0);
    onHighlightMessage(null);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        className={cn("h-8 w-8", className)}
        title="Sök i meddelanden"
      >
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 bg-background border rounded-lg px-2 py-1", className)}>
      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Sök i meddelanden..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-7 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-1 min-w-[120px] text-sm"
      />
      {searchQuery && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {matchedMessages.length > 0
            ? `${currentIndex + 1}/${matchedMessages.length}`
            : "0 träffar"}
        </span>
      )}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevious}
          disabled={matchedMessages.length === 0}
          className="h-6 w-6"
          title="Föregående (Shift+Enter)"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNext}
          disabled={matchedMessages.length === 0}
          className="h-6 w-6"
          title="Nästa (Enter)"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClose}
        className="h-6 w-6"
        title="Stäng"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};
