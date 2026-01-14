import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Save,
  Trash2,
  Sparkles,
  FileText,
  Wand2,
  Languages,
  Loader2,
  X,
} from "lucide-react";
import { Note } from "@/hooks/useNotes";
import { useNoteAI, NoteAIAction } from "@/hooks/useNoteAI";

interface NoteEditorProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteId: string, updates: { title?: string; content?: string }) => Promise<Note | null>;
  onDelete: (noteId: string) => Promise<boolean>;
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "sv", name: "Swedish" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "pt", name: "Portuguese" },
];

export const NoteEditor = ({
  note,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: NoteEditorProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const { processNote, isProcessing, cancel } = useNoteAI();

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setAiResult(null);
    }
  }, [note]);

  const handleSave = async () => {
    if (!note) return;
    setIsSaving(true);
    try {
      await onSave(note.id, { title, content });
    } catch (err) {
      console.error("Save error:", err);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!note) return;
    setIsDeleting(true);
    const success = await onDelete(note.id);
    setIsDeleting(false);
    if (success) {
      onClose();
    }
  };

  const handleAIAction = useCallback(
    async (action: NoteAIAction, targetLanguage?: string) => {
      setAiResult("");
      await processNote(
        action,
        content,
        targetLanguage,
        (delta) => {
          setAiResult((prev) => (prev || "") + delta);
        },
        () => {}
      );
    },
    [content, processNote]
  );

  const applyAIResult = () => {
    if (aiResult) {
      setContent(aiResult);
      setAiResult(null);
    }
  };

  const discardAIResult = () => {
    setAiResult(null);
    cancel();
  };

  if (!note) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] h-[90vh] sm:h-[80vh] flex flex-col p-4 sm:p-6 gap-4">
        <DialogHeader className="flex-shrink-0 pb-2">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="hidden sm:inline">Edit Note</span>
              <span className="sm:hidden">Note</span>
            </DialogTitle>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="h-8 px-2 sm:px-3"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Save</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="text-base sm:text-lg font-semibold h-10 sm:h-11"
          />

          {/* AI Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap flex-shrink-0">
            <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              <span className="hidden sm:inline">AI Actions:</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAIAction("summarize")}
              disabled={isProcessing}
              className="h-7 text-xs px-2"
            >
              <FileText className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Summarize</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAIAction("enhance")}
              disabled={isProcessing}
              className="h-7 text-xs px-2"
            >
              <Wand2 className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Enhance</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isProcessing} className="h-7 text-xs px-2">
                  <Languages className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">Translate</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => handleAIAction("translate", lang.name)}
                  >
                    {lang.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {isProcessing && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Processing...</span>
                <Button variant="ghost" size="sm" onClick={cancel} className="h-6 text-xs px-1.5">
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-4 min-h-0 overflow-hidden">
            {/* Original/Editable Content */}
            <div className="flex-1 flex flex-col min-h-0">
              <label className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                Content
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your note here..."
                className="flex-1 resize-none text-sm leading-relaxed min-h-[150px] sm:min-h-0"
              />
            </div>

            {/* AI Result */}
            {aiResult !== null && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 uppercase tracking-wide">
                    <Sparkles className="h-3 w-3" />
                    AI Result
                  </label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={applyAIResult}
                      disabled={isProcessing}
                      className="h-6 text-xs px-2"
                    >
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={discardAIResult}
                      className="h-6 text-xs px-1.5"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-3 rounded-md bg-muted/30 border border-border overflow-auto min-h-[150px] sm:min-h-0">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {aiResult || (isProcessing ? "..." : "")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
