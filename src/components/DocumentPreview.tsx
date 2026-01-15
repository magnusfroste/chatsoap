import { FileText, File, Download, Bot, BookOpen, Loader2, ExternalLink, Copy, MoreHorizontal, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

interface DocumentPreviewProps {
  url: string;
  name: string;
  type: "pdf" | "document" | "image";
  isOwnMessage?: boolean;
  onAnalyze?: () => void;
  showAnalyzeButton?: boolean;
  onSaveToNotes?: (title: string, content: string) => void;
  showSaveToNotesButton?: boolean;
}

export const DocumentPreview = ({
  url,
  name,
  type,
  isOwnMessage = false,
  onAnalyze,
  showAnalyzeButton = true,
  onSaveToNotes,
  showSaveToNotesButton = true,
}: DocumentPreviewProps) => {
  const [isParsing, setIsParsing] = useState(false);
  const [imageFullscreen, setImageFullscreen] = useState(false);

  const handleParseToNotes = async () => {
    if (!onSaveToNotes) return;
    
    setIsParsing(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            documentUrl: url,
            documentName: name,
            mimeType: type === "pdf" ? "application/pdf" : "application/octet-stream",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          toast.error("Rate limit. Vänta lite och försök igen.");
        } else if (response.status === 402) {
          toast.error("AI credits slut. Kontakta admin.");
        } else {
          toast.error(errorData.error || "Kunde inte parsa dokumentet");
        }
        return;
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullText = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullText += content;
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) fullText += content;
          } catch { /* ignore */ }
        }
      }

      const title = name.replace(/\.[^/.]+$/, "") || "Importerat dokument";
      onSaveToNotes(title, fullText);
      toast.success("Dokument sparat som anteckning!");
    } catch (error) {
      console.error("Parse to notes error:", error);
      toast.error("Något gick fel vid parsning");
    } finally {
      setIsParsing(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    toast.success("Länk kopierad!");
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Image preview with elegant overlay
  if (type === "image") {
    return (
      <TooltipProvider>
        <div className="group relative max-w-[280px] rounded-lg overflow-hidden">
          <img
            src={url}
            alt={name}
            className="max-w-full max-h-[300px] rounded-lg object-cover cursor-pointer transition-transform"
            onClick={() => setImageFullscreen(true)}
          />
          {/* Hover overlay with actions */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageFullscreen(true);
                  }}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fullskärm</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ladda ner</TooltipContent>
            </Tooltip>
            {showSaveToNotesButton && onSaveToNotes && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSaveToNotes(name.replace(/\.[^/.]+$/, ""), `![${name}](${url})`);
                      toast.success("Bild sparad till anteckningar!");
                    }}
                  >
                    <BookOpen className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Till anteckningar</TooltipContent>
              </Tooltip>
            )}
          </div>
          
          {/* Fullscreen modal */}
          {imageFullscreen && (
            <div
              className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
              onClick={() => setImageFullscreen(false)}
            >
              <img
                src={url}
                alt={name}
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white hover:bg-white/20"
                onClick={() => setImageFullscreen(false)}
              >
                ✕
              </Button>
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }

  const FileIcon = type === "pdf" ? FileText : File;

  // Document preview with compact icon-based actions
  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg max-w-[320px]",
          isOwnMessage
            ? "bg-primary-foreground/10"
            : "bg-muted/50"
        )}
      >
        {/* File icon */}
        <div
          className={cn(
            "w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0",
            type === "pdf"
              ? "bg-red-100 dark:bg-red-900/30"
              : "bg-blue-100 dark:bg-blue-900/30"
          )}
        >
          <FileIcon
            className={cn(
              "w-5 h-5",
              type === "pdf"
                ? "text-red-600 dark:text-red-400"
                : "text-blue-600 dark:text-blue-400"
            )}
          />
        </div>

        {/* File info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">
            {type === "pdf" ? "PDF" : "Dokument"}
          </p>
        </div>

        {/* Compact action buttons */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ladda ner</TooltipContent>
          </Tooltip>

          {showAnalyzeButton && onAnalyze && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={onAnalyze}
                >
                  <Bot className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Analysera med AI</TooltipContent>
            </Tooltip>
          )}

          {showSaveToNotesButton && onSaveToNotes && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={handleParseToNotes}
                  disabled={isParsing}
                >
                  {isParsing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BookOpen className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isParsing ? "Parsar..." : "Till anteckningar"}</TooltipContent>
            </Tooltip>
          )}

          {/* More options dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyLink}>
                <Copy className="w-4 h-4 mr-2" />
                Kopiera länk
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(url, "_blank")}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Öppna i ny flik
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
};
