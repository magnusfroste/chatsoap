import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, Bot, BookOpen, Maximize2, FileText, File, Image as ImageIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  content: string;
  attachment_type: string | null;
  attachment_name: string | null;
  created_at: string;
  user_id: string | null;
}

interface ChatMediaLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onAnalyze?: (url: string, name: string, mimeType: string) => void;
  onSaveToNotes?: (title: string, content: string) => void;
}

const isImageUrl = (content: string): boolean => {
  if (!content) return false;
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
  const isUrl = content.startsWith("http://") || content.startsWith("https://");
  return isUrl && (imageExtensions.test(content) || content.includes("/storage/v1/object/"));
};

const isDocumentUrl = (content: string): boolean => {
  if (!content) return false;
  const docExtensions = /\.(pdf|doc|docx|txt|xls|xlsx|ppt|pptx)(\?.*)?$/i;
  const isUrl = content.startsWith("http://") || content.startsWith("https://");
  return isUrl && docExtensions.test(content);
};

const getDocumentType = (content: string): "pdf" | "document" => {
  return content.toLowerCase().includes(".pdf") ? "pdf" : "document";
};

const getFilenameFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/");
    return decodeURIComponent(parts[parts.length - 1]) || "dokument";
  } catch {
    return "dokument";
  }
};

export const ChatMediaLibrary = ({
  open,
  onOpenChange,
  conversationId,
  onAnalyze,
  onSaveToNotes,
}: ChatMediaLibraryProps) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [parsingDocId, setParsingDocId] = useState<string | null>(null);

  useEffect(() => {
    if (open && conversationId) {
      fetchMedia();
    }
  }, [open, conversationId]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, attachment_type, attachment_name, created_at, user_id")
        .eq("conversation_id", conversationId)
        .or("attachment_type.not.is.null,content.ilike.%storage%")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter to only include actual media/files
      const filtered = (data || []).filter((item) => {
        return isImageUrl(item.content) || isDocumentUrl(item.content) || item.attachment_type;
      });

      setMediaItems(filtered);
    } catch (error) {
      console.error("Error fetching media:", error);
    } finally {
      setLoading(false);
    }
  };

  const images = mediaItems.filter((item) => isImageUrl(item.content));
  const documents = mediaItems.filter((item) => isDocumentUrl(item.content) || (item.attachment_type && !isImageUrl(item.content)));

  const handleDownload = (url: string, name?: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = name || getFilenameFromUrl(url);
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleParseToNotes = async (item: MediaItem) => {
    if (!onSaveToNotes) return;

    setParsingDocId(item.id);

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
            documentUrl: item.content,
            documentName: item.attachment_name || getFilenameFromUrl(item.content),
            mimeType: getDocumentType(item.content) === "pdf" ? "application/pdf" : "application/octet-stream",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          toast.error("Rate limit. Vänta lite och försök igen.");
        } else {
          toast.error(errorData.error || "Kunde inte parsa dokumentet");
        }
        return;
      }

      if (!response.body) throw new Error("No response body");

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
            if (content) fullText += content;
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      const title = (item.attachment_name || getFilenameFromUrl(item.content)).replace(/\.[^/.]+$/, "") || "Importerat dokument";
      onSaveToNotes(title, fullText);
      toast.success("Dokument sparat som anteckning!");
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Något gick fel vid parsning");
    } finally {
      setParsingDocId(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Media & Filer
            </SheetTitle>
          </SheetHeader>

          <Tabs defaultValue="all" className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-2 grid grid-cols-3">
              <TabsTrigger value="all">Alla ({mediaItems.length})</TabsTrigger>
              <TabsTrigger value="images">Bilder ({images.length})</TabsTrigger>
              <TabsTrigger value="documents">Dokument ({documents.length})</TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="all" className="flex-1 m-0">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                      {images.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Bilder</h3>
                          <div className="grid grid-cols-3 gap-2">
                            {images.slice(0, 6).map((item) => (
                              <ImageThumbnail
                                key={item.id}
                                item={item}
                                onFullscreen={() => setSelectedImage(item.content)}
                                onDownload={() => handleDownload(item.content)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {documents.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Dokument</h3>
                          <div className="space-y-2">
                            {documents.map((item) => (
                              <DocumentRow
                                key={item.id}
                                item={item}
                                onDownload={() => handleDownload(item.content, item.attachment_name || undefined)}
                                onAnalyze={onAnalyze ? () => {
                                  const name = item.attachment_name || getFilenameFromUrl(item.content);
                                  const mimeType = getDocumentType(item.content) === "pdf" ? "application/pdf" : "application/octet-stream";
                                  onAnalyze(item.content, name, mimeType);
                                  onOpenChange(false);
                                } : undefined}
                                onSaveToNotes={onSaveToNotes ? () => handleParseToNotes(item) : undefined}
                                isParsing={parsingDocId === item.id}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {mediaItems.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Inga media eller filer än</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="images" className="flex-1 m-0">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      {images.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {images.map((item) => (
                            <ImageThumbnail
                              key={item.id}
                              item={item}
                              onFullscreen={() => setSelectedImage(item.content)}
                              onDownload={() => handleDownload(item.content)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Inga bilder än</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="documents" className="flex-1 m-0">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-2">
                      {documents.length > 0 ? (
                        documents.map((item) => (
                          <DocumentRow
                            key={item.id}
                            item={item}
                            onDownload={() => handleDownload(item.content, item.attachment_name || undefined)}
                            onAnalyze={onAnalyze ? () => {
                              const name = item.attachment_name || getFilenameFromUrl(item.content);
                              const mimeType = getDocumentType(item.content) === "pdf" ? "application/pdf" : "application/octet-stream";
                              onAnalyze(item.content, name, mimeType);
                              onOpenChange(false);
                            } : undefined}
                            onSaveToNotes={onSaveToNotes ? () => handleParseToNotes(item) : undefined}
                            isParsing={parsingDocId === item.id}
                          />
                        ))
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Inga dokument än</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </>
            )}
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Fullscreen Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Fullscreen"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setSelectedImage(null)}
          >
            ✕
          </Button>
        </div>
      )}
    </>
  );
};

// Sub-components
interface ImageThumbnailProps {
  item: MediaItem;
  onFullscreen: () => void;
  onDownload: () => void;
}

const ImageThumbnail = ({ item, onFullscreen, onDownload }: ImageThumbnailProps) => (
  <div className="group relative aspect-square rounded-lg overflow-hidden bg-muted">
    <img
      src={item.content}
      alt=""
      className="w-full h-full object-cover"
    />
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              onFullscreen();
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
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
          >
            <Download className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ladda ner</TooltipContent>
      </Tooltip>
    </div>
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <p className="text-[10px] text-white/80 truncate">
        {format(new Date(item.created_at), "d MMM yyyy", { locale: sv })}
      </p>
    </div>
  </div>
);

interface DocumentRowProps {
  item: MediaItem;
  onDownload: () => void;
  onAnalyze?: () => void;
  onSaveToNotes?: () => void;
  isParsing?: boolean;
}

const DocumentRow = ({ item, onDownload, onAnalyze, onSaveToNotes, isParsing }: DocumentRowProps) => {
  const docType = getDocumentType(item.content);
  const fileName = item.attachment_name || getFilenameFromUrl(item.content);
  const FileIcon = docType === "pdf" ? FileText : File;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
        docType === "pdf" ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30"
      }`}>
        <FileIcon className={`w-5 h-5 ${
          docType === "pdf" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(item.created_at), "d MMM yyyy", { locale: sv })}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDownload}>
              <Download className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ladda ner</TooltipContent>
        </Tooltip>
        {onAnalyze && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAnalyze}>
                <Bot className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Analysera med AI</TooltipContent>
          </Tooltip>
        )}
        {onSaveToNotes && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSaveToNotes} disabled={isParsing}>
                {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Spara till anteckningar</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
