import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Save,
  Trash2,
  Sparkles,
  FileText,
  Wand2,
  Languages,
  Loader2,
  X,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Link,
  Code,
  Quote,
  Eye,
  Edit3,
  Copy,
  Check,
} from "lucide-react";
import { Note } from "@/hooks/useNotes";
import { useNoteAI, NoteAIAction } from "@/hooks/useNoteAI";

// Custom code block component with syntax highlighting
interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CodeBlock = ({ inline, className, children, ...props }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono" {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-4">
      {language && (
        <div className="absolute top-0 left-0 px-3 py-1 text-xs text-muted-foreground bg-muted/50 rounded-tl-md rounded-br-md font-mono">
          {language}
        </div>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-muted/80 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy code"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      <SyntaxHighlighter
        style={oneDark}
        language={language || "text"}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          padding: language ? "2.5rem 1rem 1rem" : "1rem",
        }}
        {...props}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
};

// Markdown components configuration
const markdownComponents = {
  code: CodeBlock,
};

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

interface FormatAction {
  icon: React.ReactNode;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
  shortcut?: string; // e.g., "b" for Ctrl+B
}

const FORMAT_ACTIONS: FormatAction[] = [
  { icon: <Bold className="h-3.5 w-3.5" />, label: "Bold", prefix: "**", suffix: "**", shortcut: "b" },
  { icon: <Italic className="h-3.5 w-3.5" />, label: "Italic", prefix: "_", suffix: "_", shortcut: "i" },
  { icon: <Code className="h-3.5 w-3.5" />, label: "Code", prefix: "`", suffix: "`", shortcut: "e" },
  { icon: <Heading1 className="h-3.5 w-3.5" />, label: "Heading 1", prefix: "# ", suffix: "", block: true, shortcut: "1" },
  { icon: <Heading2 className="h-3.5 w-3.5" />, label: "Heading 2", prefix: "## ", suffix: "", block: true, shortcut: "2" },
  { icon: <List className="h-3.5 w-3.5" />, label: "Bullet List", prefix: "- ", suffix: "", block: true, shortcut: "u" },
  { icon: <ListOrdered className="h-3.5 w-3.5" />, label: "Numbered List", prefix: "1. ", suffix: "", block: true, shortcut: "o" },
  { icon: <Quote className="h-3.5 w-3.5" />, label: "Quote", prefix: "> ", suffix: "", block: true, shortcut: "q" },
  { icon: <Link className="h-3.5 w-3.5" />, label: "Link", prefix: "[", suffix: "](url)", shortcut: "k" },
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
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const { processNote, isProcessing, cancel } = useNoteAI();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setAiResult(null);
      setActiveTab("edit");
    }
  }, [note]);

  const handleSave = useCallback(async () => {
    if (!note) return;
    setIsSaving(true);
    try {
      await onSave(note.id, { title, content });
    } catch (err) {
      console.error("Save error:", err);
    }
    setIsSaving(false);
  }, [note, onSave, title, content]);

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

  const applyFormat = (action: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let newContent: string;
    let newCursorPos: number;

    if (action.block) {
      // For block-level formatting, apply to beginning of line
      const lineStart = content.lastIndexOf("\n", start - 1) + 1;
      const beforeLine = content.substring(0, lineStart);
      const afterStart = content.substring(lineStart);
      
      newContent = beforeLine + action.prefix + afterStart;
      newCursorPos = start + action.prefix.length;
    } else {
      // For inline formatting, wrap selection
      const before = content.substring(0, start);
      const after = content.substring(end);
      
      if (selectedText) {
        newContent = before + action.prefix + selectedText + action.suffix + after;
        newCursorPos = end + action.prefix.length + action.suffix.length;
      } else {
        newContent = before + action.prefix + action.suffix + after;
        newCursorPos = start + action.prefix.length;
      }
    }

    setContent(newContent);
    
    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Keyboard shortcut handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Check for Ctrl/Cmd key
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      
      // Ctrl+S to save
      if (key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }
      
      // Find matching format action
      const action = FORMAT_ACTIONS.find(a => a.shortcut === key);
      if (action) {
        e.preventDefault();
        applyFormat(action);
      }
    }
  }, [handleSave]);

  if (!note) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] sm:h-[85vh] flex flex-col p-4 sm:p-6 gap-3">
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
              <span className="hidden sm:inline">AI:</span>
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
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "preview")} className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <TabsList className="h-8">
                    <TabsTrigger value="edit" className="h-7 text-xs px-3 gap-1.5">
                      <Edit3 className="h-3 w-3" />
                      Edit
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="h-7 text-xs px-3 gap-1.5">
                      <Eye className="h-3 w-3" />
                      Preview
                    </TabsTrigger>
                  </TabsList>

                  {/* Formatting Toolbar - only show in edit mode */}
                  {activeTab === "edit" && (
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      {FORMAT_ACTIONS.map((action, index) => (
                        <Tooltip key={index}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => applyFormat(action)}
                              className="h-7 w-7 p-0"
                            >
                              {action.icon}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {action.label}
                            {action.shortcut && (
                              <span className="ml-2 text-muted-foreground">
                                ⌘{action.shortcut.toUpperCase()}
                              </span>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>

                <TabsContent value="edit" className="flex-1 m-0 min-h-0">
                  <Textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Write your note in Markdown..."
                    className="h-full resize-none text-sm leading-relaxed font-mono"
                  />
                </TabsContent>

                <TabsContent value="preview" className="flex-1 m-0 min-h-0 overflow-auto">
                  <div className="h-full p-4 rounded-md border border-border bg-card prose prose-sm dark:prose-invert max-w-none overflow-auto">
                    {content ? (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground italic">Nothing to preview...</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* AI Result */}
            {aiResult !== null && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
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
                <div className="flex-1 p-3 rounded-md bg-muted/30 border border-border overflow-auto min-h-[150px] sm:min-h-0 prose prose-sm dark:prose-invert max-w-none">
                  {aiResult ? (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {aiResult}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground">{isProcessing ? "..." : ""}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
