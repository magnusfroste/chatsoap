import { FileText, File, Download, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DocumentPreviewProps {
  url: string;
  name: string;
  type: "pdf" | "document" | "image";
  isOwnMessage?: boolean;
  onAnalyze?: () => void;
  showAnalyzeButton?: boolean;
}

export const DocumentPreview = ({
  url,
  name,
  type,
  isOwnMessage = false,
  onAnalyze,
  showAnalyzeButton = true,
}: DocumentPreviewProps) => {
  if (type === "image") {
    return (
      <img
        src={url}
        alt={name}
        className="max-w-[280px] max-h-[300px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => window.open(url, "_blank")}
      />
    );
  }

  const FileIcon = type === "pdf" ? FileText : File;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 rounded-lg max-w-[280px]",
        isOwnMessage
          ? "bg-primary-foreground/10"
          : "bg-muted/50"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
            type === "pdf"
              ? "bg-red-100 dark:bg-red-900/30"
              : "bg-blue-100 dark:bg-blue-900/30"
          )}
        >
          <FileIcon
            className={cn(
              "w-6 h-6",
              type === "pdf"
                ? "text-red-600 dark:text-red-400"
                : "text-blue-600 dark:text-blue-400"
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">
            {type === "pdf" ? "PDF-dokument" : "Dokument"}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-8 text-xs"
          onClick={() => window.open(url, "_blank")}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Öppna
        </Button>
        {showAnalyzeButton && onAnalyze && (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={onAnalyze}
          >
            <Bot className="w-3.5 h-3.5 mr-1.5" />
            Analysera
          </Button>
        )}
      </div>
    </div>
  );
};
