import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Mic } from "lucide-react";
import { ReplyPreview } from "@/components/MessageBubble";
import { EmojiPicker } from "@/components/EmojiPicker";
import { FileUploadButton, FilePreview, UploadedFile } from "@/components/FileUploadButton";
import { CAGContextBadge } from "@/components/CAGContextBadge";
import { CAGFile, CAGNote } from "@/hooks/useCAGContext";

interface ReplyToMessage {
  id: string;
  content: string;
  user_id: string | null;
  is_ai: boolean;
  profile?: {
    display_name: string | null;
  };
}

interface ChatMessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  sending: boolean;
  disabled?: boolean;
  // Reply
  replyTo: ReplyToMessage | null;
  onCancelReply: () => void;
  currentUserId?: string;
  // File
  pendingFile: UploadedFile | null;
  onFileSelect: (file: UploadedFile) => void;
  onRemoveFile: () => void;
  // CAG Context
  cagFiles?: CAGFile[];
  cagNotes?: CAGNote[];
  onRemoveCAGFile?: (fileId: string) => void;
  onRemoveCAGNote?: (noteId: string) => void;
  onClearCAG?: () => void;
  // Styling
  variant?: "direct" | "group";
  // Hints
  isAIChat?: boolean;
  showAnalyzeHint?: boolean;
}

export const ChatMessageInput = ({
  value,
  onChange,
  onSubmit,
  onTyping,
  onStopTyping,
  sending,
  disabled = false,
  replyTo,
  onCancelReply,
  currentUserId,
  pendingFile,
  onFileSelect,
  onRemoveFile,
  cagFiles = [],
  cagNotes = [],
  onRemoveCAGFile,
  onRemoveCAGNote,
  onClearCAG,
  variant = "direct",
  isAIChat = false,
  showAnalyzeHint = false,
}: ChatMessageInputProps) => {
  const isGroup = variant === "group";
  const maxWidth = isGroup ? "max-w-3xl" : "max-w-4xl";
  const hasContent = value.trim() || pendingFile;

  // Placeholder text
  const getPlaceholder = () => {
    if (cagFiles.length > 0) {
      return `Ask about your ${cagFiles.length} file${cagFiles.length > 1 ? 's' : ''}...`;
    }
    if (isAIChat) {
      return "Write a message to AI...";
    }
    return "Write a message";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    onTyping();
  };

  return (
    <div className={isGroup 
      ? "bg-whatsapp-chat-bg border-t border-border/50 p-2" 
      : "flex-shrink-0 bg-card border-t border-border px-2 sm:px-3 py-2"
    }>
      {/* File preview */}
      {pendingFile && (
        <div className={`${maxWidth} mx-auto mb-3`}>
          <FilePreview 
            file={pendingFile} 
            onRemove={onRemoveFile} 
            showAnalyzeHint={showAnalyzeHint && pendingFile.type !== "image"}
          />
        </div>
      )}
      
      {/* Reply preview */}
      {replyTo && (
        <div className={`${maxWidth} mx-auto mb-2`}>
          <ReplyPreview 
            replyTo={replyTo} 
            currentUserId={currentUserId} 
            onCancel={onCancelReply} 
          />
        </div>
      )}

      {/* CAG Context Badge */}
      {(cagFiles.length > 0 || cagNotes.length > 0) && onRemoveCAGFile && onClearCAG && (
        <div className={`${maxWidth} mx-auto mb-2`}>
          <CAGContextBadge 
            files={cagFiles} 
            notes={cagNotes}
            onRemoveFile={onRemoveCAGFile} 
            onRemoveNote={onRemoveCAGNote}
            onClearAll={onClearCAG} 
          />
        </div>
      )}
      
      <form onSubmit={onSubmit} className={`flex items-center gap-2 ${maxWidth} mx-auto`}>
        <EmojiPicker 
          onEmojiSelect={(emoji) => onChange(value + emoji)} 
        />
        
        {isGroup ? (
          // Group variant: rounded pill input with file button inside
          <div className="flex-1 flex items-center bg-white dark:bg-card rounded-full px-4 py-2 shadow-sm">
            <Input
              value={value}
              onChange={handleInputChange}
              onBlur={onStopTyping}
              placeholder={getPlaceholder()}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-sm"
              disabled={sending || disabled}
            />
            <FileUploadButton 
              onFileSelect={onFileSelect} 
              className="h-8 w-8"
            />
          </div>
        ) : (
          // Direct variant: separate file button and input
          <>
            <FileUploadButton 
              onFileSelect={onFileSelect} 
            />
            
            <div className="flex-1">
              <Input
                value={value}
                onChange={handleInputChange}
                onBlur={onStopTyping}
                placeholder={getPlaceholder()}
                className="bg-muted/50 border-0 rounded-lg h-10 focus-visible:ring-1 focus-visible:ring-ring"
                disabled={sending || disabled}
              />
            </div>
          </>
        )}

        {hasContent ? (
          <Button 
            type="submit" 
            size="icon" 
            disabled={sending}
            className={isGroup 
              ? "flex-shrink-0 rounded-full w-12 h-12 bg-whatsapp-green hover:bg-whatsapp-green-dark shadow-md"
              : "flex-shrink-0 rounded-full w-10 h-10 bg-primary hover:bg-primary/90"
            }
          >
            <Send className="w-5 h-5" />
          </Button>
        ) : (
          <Button 
            type="button" 
            size="icon"
            className={isGroup 
              ? "flex-shrink-0 rounded-full w-12 h-12 bg-whatsapp-green hover:bg-whatsapp-green-dark shadow-md"
              : "flex-shrink-0 rounded-full w-10 h-10 bg-primary hover:bg-primary/90"
            }
          >
            <Mic className="w-5 h-5" />
          </Button>
        )}
      </form>

      {/* AI hint */}
      {isGroup ? (
        <p className="text-center text-xs text-muted-foreground mt-2">
          Skriv <span className="font-medium text-whatsapp-green">@ai</span> för att prata med AI-assistenten
        </p>
      ) : (
        <>
          {!isAIChat && (
            <p className={`text-center text-xs text-muted-foreground mt-2 ${maxWidth} mx-auto`}>
              Type <span className="font-medium text-primary">@ai</span> to chat with AI
              {pendingFile && pendingFile.type !== "image" && (
                <span> • Attach document + @ai to analyze</span>
              )}
            </p>
          )}
          {isAIChat && pendingFile && pendingFile.type !== "image" && (
            <p className={`text-center text-xs text-muted-foreground mt-2 ${maxWidth} mx-auto`}>
              Type a question to analyze the document
            </p>
          )}
        </>
      )}
    </div>
  );
};
