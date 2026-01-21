import { Paperclip, FileText, Image as ImageIcon, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { emitOpenApp } from "@/lib/canvas-apps/events";

interface FileInfo {
  name: string;
  type: "image" | "pdf" | "document";
}

interface FileAttachmentBadgeProps {
  files: FileInfo[];
  onClick?: () => void;
  className?: string;
}

/**
 * Compact file attachment indicator for chat bubbles.
 * Clicking opens the Files tab in Canvas.
 */
export const FileAttachmentBadge = ({ 
  files, 
  onClick,
  className 
}: FileAttachmentBadgeProps) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default: open Files tab in canvas
      emitOpenApp("files");
    }
  };

  const getIcon = () => {
    if (files.length === 1) {
      const file = files[0];
      if (file.type === "image") return <ImageIcon className="w-4 h-4" />;
      if (file.type === "pdf") return <FileText className="w-4 h-4" />;
      return <File className="w-4 h-4" />;
    }
    return <Paperclip className="w-4 h-4" />;
  };

  const getLabel = () => {
    if (files.length === 1) {
      return files[0].name;
    }
    return `${files.length} files`;
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 rounded-lg",
        "bg-muted/50 hover:bg-muted transition-colors",
        "text-sm text-foreground cursor-pointer",
        "border border-border/50 hover:border-border",
        "group",
        className
      )}
    >
      <span className="text-muted-foreground group-hover:text-primary transition-colors">
        {getIcon()}
      </span>
      <span className="truncate max-w-[180px]">{getLabel()}</span>
      <span className="text-xs text-muted-foreground ml-1">
        →
      </span>
    </button>
  );
};

// Helper to detect file type from URL or mime type
export function getFileTypeFromUrl(url: string): "image" | "pdf" | "document" {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i)) return "image";
  if (lowerUrl.endsWith(".pdf")) return "pdf";
  return "document";
}

// Helper to extract filename from URL
export function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || "file";
    // Remove timestamp prefix if present (e.g., "1234567890-abc123.pdf" -> "dokument.pdf")
    const parts = filename.split('-');
    if (parts.length > 1 && /^\d+$/.test(parts[0])) {
      return decodeURIComponent(parts.slice(1).join('-'));
    }
    return decodeURIComponent(filename);
  } catch {
    return "file";
  }
}
