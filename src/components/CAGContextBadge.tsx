import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, X, FileText, Image as ImageIcon, File, Trash2, StickyNote } from "lucide-react";
import { CAGFile, CAGNote } from "@/hooks/useCAGContext";

interface CAGContextBadgeProps {
  files: CAGFile[];
  notes?: CAGNote[];
  onRemoveFile: (fileId: string) => void;
  onRemoveNote?: (noteId: string) => void;
  onClearAll: () => void;
}

export const CAGContextBadge = ({
  files,
  notes = [],
  onRemoveFile,
  onRemoveNote,
  onClearAll,
}: CAGContextBadgeProps) => {
  const totalCount = files.length + notes.length;
  
  if (totalCount === 0) return null;

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image")) {
      return <ImageIcon className="w-3.5 h-3.5 text-blue-500" />;
    }
    if (mimeType === "application/pdf") {
      return <FileText className="w-3.5 h-3.5 text-red-500" />;
    }
    return <File className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const getContextLabel = () => {
    if (files.length > 0 && notes.length > 0) {
      return `${files.length} file${files.length !== 1 ? "s" : ""}, ${notes.length} note${notes.length !== 1 ? "s" : ""} in AI context`;
    }
    if (files.length > 0) {
      return `${files.length} file${files.length !== 1 ? "s" : ""} in AI context`;
    }
    return `${notes.length} note${notes.length !== 1 ? "s" : ""} in AI context`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs bg-primary/10 hover:bg-primary/20 text-primary"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{getContextLabel()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">AI Context</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={onClearAll}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Clear all
          </Button>
        </div>
        <ScrollArea className="max-h-48">
          <div className="p-2 space-y-1">
            {/* Files section */}
            {files.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Files
                </div>
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group"
                  >
                    {getFileIcon(file.mimeType)}
                    <span className="flex-1 text-sm truncate" title={file.name}>
                      {file.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onRemoveFile(file.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </>
            )}
            
            {/* Notes section */}
            {notes.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide mt-2">
                  Notes
                </div>
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group"
                  >
                    <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                    <span className="flex-1 text-sm truncate" title={note.title}>
                      {note.title}
                    </span>
                    {onRemoveNote && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onRemoveNote(note.id)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
        <div className="p-2 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            These items will be included when you use @ai
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
