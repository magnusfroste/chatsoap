import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES = {
  smileys: ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐"],
  gestures: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "🦾", "🦿"],
  hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"],
  objects: ["🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "⚽", "🏀", "🎮", "🎯", "🎭", "🎨", "🎬", "🎤", "🎧", "🎸", "🎹", "🥁", "📱", "💻", "⌨️", "🖥️", "📷", "📹", "🔔", "📣", "💡", "🔦", "📚", "📖", "✏️", "📝", "💼", "📁", "📅", "📌", "📎", "🔑", "🔒"],
  nature: ["🌸", "🌺", "🌻", "🌼", "🌷", "🌹", "🥀", "🌱", "🌲", "🌳", "🌴", "🌵", "🍀", "🍁", "🍂", "🍃", "🌾", "🌿", "☘️", "🍄", "🌰", "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷"],
  food: ["🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🥦", "🥬", "🌶️", "🌽", "🥕", "🧄", "🧅", "🥔", "🍠", "🥐", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🥞", "🧇", "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🥗", "🍿", "🧈", "🍰", "🎂", "🧁", "🍩", "🍪", "☕", "🍵", "🧃", "🥤", "🍺", "🍷", "🥂", "🍾"],
};

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

export const EmojiPicker = ({ onEmojiSelect, className }: EmojiPickerProps) => {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>("smileys");

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  const categoryIcons: Record<keyof typeof EMOJI_CATEGORIES, string> = {
    smileys: "😊",
    gestures: "👋",
    hearts: "❤️",
    objects: "🎉",
    nature: "🌸",
    food: "🍎",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("flex-shrink-0 text-muted-foreground hover:text-foreground rounded-full", className)}
        >
          <Smile className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-2" 
        align="start"
        side="top"
        sideOffset={8}
      >
        {/* Category tabs */}
        <div className="flex gap-1 pb-2 border-b border-border mb-2">
          {Object.keys(EMOJI_CATEGORIES).map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category as keyof typeof EMOJI_CATEGORIES)}
              className={cn(
                "p-1.5 rounded-md text-lg transition-colors",
                activeCategory === category
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              )}
            >
              {categoryIcons[category as keyof typeof EMOJI_CATEGORIES]}
            </button>
          ))}
        </div>

        {/* Emoji grid */}
        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
          {EMOJI_CATEGORIES[activeCategory].map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => handleEmojiClick(emoji)}
              className="p-1.5 text-xl hover:bg-muted rounded-md transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
