import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, X, FileText, Image as ImageIcon, File, Trash2 } from "lucide-react";
import { CAGFile } from "@/hooks/useCAGContext";

interface CAGContextBadgeProps {
  files: CAGFile[];
  onRemoveFile: (fileId: string) => void;
  onClearAll: () => void;
}

export const CAGContextBadge = ({
  files,
  onRemoveFile,
  onClearAll,
}: CAGContextBadgeProps) => {
  if (files.length === 0) return null;

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image")) {
      return <ImageIcon className="w-3.5 h-3.5 text-blue-500" />;
    }
    if (mimeType === "application/pdf") {
      return <FileText className="w-3.5 h-3.5 text-red-500" />;
    }
    return <File className="w-3.5 h-3.5 text-muted-foreground" />;
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
          <span>{files.length} file{files.length !== 1 ? "s" : ""} in AI context</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">AI Context Files</span>
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
          </div>
        </ScrollArea>
        <div className="p-2 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            These files will be included when you use @ai
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
