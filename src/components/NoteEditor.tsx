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
    await onSave(note.id, { title, content });
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
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Edit Note
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="text-lg font-semibold"
          />

          {/* AI Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI Actions:
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAIAction("summarize")}
              disabled={isProcessing}
            >
              <FileText className="h-3 w-3 mr-1" />
              Summarize
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAIAction("enhance")}
              disabled={isProcessing}
            >
              <Wand2 className="h-3 w-3 mr-1" />
              Enhance
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isProcessing}>
                  <Languages className="h-3 w-3 mr-1" />
                  Translate
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
                <Button variant="ghost" size="sm" onClick={cancel}>
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Original/Editable Content */}
            <div className="flex-1 flex flex-col min-h-0">
              <label className="text-xs text-muted-foreground mb-1">
                Content
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your note here..."
                className="flex-1 resize-none"
              />
            </div>

            {/* AI Result */}
            {aiResult !== null && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Result
                  </label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={applyAIResult}
                      disabled={isProcessing}
                      className="h-6 text-xs"
                    >
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={discardAIResult}
                      className="h-6 text-xs"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-3 rounded-md bg-muted/50 border border-border overflow-auto">
                  <p className="text-sm whitespace-pre-wrap">
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
