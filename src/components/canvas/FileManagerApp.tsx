import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FolderOpen, 
  Search, 
  Loader2, 
  FileText, 
  Image as ImageIcon, 
  File,
  Grid3X3,
  List,
  Download,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

interface ConversationFile {
  id: string;
  url: string;
  name: string;
  type: "image" | "pdf" | "document";
  mimeType: string;
  messageId: string;
  createdAt: string;
  uploaderId: string | null;
  uploaderName: string | null;
}

interface FileManagerAppProps {
  conversationId: string;
  onViewDocument: (url: string, name: string, type: string) => void;
}

const FileManagerApp = ({ conversationId, onViewDocument }: FileManagerAppProps) => {
  const [files, setFiles] = useState<ConversationFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<"all" | "images" | "documents">("all");

  // Fetch files from conversation messages
  useEffect(() => {
    const fetchFiles = async () => {
      if (!conversationId) return;
      
      setIsLoading(true);
      try {
        // Fetch messages with attachments
        const { data: messages, error } = await supabase
          .from("messages")
          .select("id, content, created_at, user_id, attachment_type, attachment_name")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Filter messages that contain file URLs
        const fileMessages = messages?.filter((msg) => {
          const content = msg.content;
          return (
            content.includes("supabase.co/storage") ||
            content.match(/\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx)$/i)
          );
        }) || [];

        // Get user profiles for uploaders
        const userIds = [...new Set(fileMessages.map(m => m.user_id).filter(Boolean))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

        // Extract file info from messages
        const extractedFiles: ConversationFile[] = fileMessages.map((msg) => {
          const url = msg.content;
          const fileName = msg.attachment_name || getFilenameFromUrl(url);
          const type = getFileType(url, msg.attachment_type);
          const mimeType = getMimeType(url, msg.attachment_type);

          return {
            id: msg.id,
            url,
            name: fileName,
            type,
            mimeType,
            messageId: msg.id,
            createdAt: msg.created_at,
            uploaderId: msg.user_id,
            uploaderName: msg.user_id ? profileMap.get(msg.user_id) || "User" : null,
          };
        });

        setFiles(extractedFiles);
      } catch (err) {
        console.error("Failed to fetch files:", err);
        toast.error("Failed to load files");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFiles();
  }, [conversationId]);

  // Filter files
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      filter === "all" ||
      (filter === "images" && file.type === "image") ||
      (filter === "documents" && (file.type === "pdf" || file.type === "document"));
    return matchesSearch && matchesFilter;
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case "image":
        return <ImageIcon className="w-5 h-5 text-blue-500" />;
      case "pdf":
        return <FileText className="w-5 h-5 text-red-500" />;
      default:
        return <File className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const handleDownload = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = name;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      toast.error("Failed to download file");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Files</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {files.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="h-8 w-8"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/50"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          <Badge
            variant={filter === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("all")}
          >
            All
          </Badge>
          <Badge
            variant={filter === "images" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("images")}
          >
            <ImageIcon className="w-3 h-3 mr-1" />
            Images
          </Badge>
          <Badge
            variant={filter === "documents" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("documents")}
          >
            <FileText className="w-3 h-3 mr-1" />
            Documents
          </Badge>
        </div>
      </div>

      {/* Files Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery ? "No matching files" : "No files yet"}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[250px]">
                {searchQuery 
                  ? "Try a different search term" 
                  : "Files uploaded in chat will appear here"}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-all"
                >
                  {/* Preview */}
                  <div 
                    className="aspect-square bg-muted/50 flex items-center justify-center cursor-pointer"
                    onClick={() => onViewDocument(file.url, file.name, file.mimeType)}
                  >
                    {file.type === "image" ? (
                      <img 
                        src={file.url} 
                        alt={file.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getFileIcon(file.type)
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(file.createdAt), "MMM d")}
                    </p>
                  </div>

                  {/* Hover actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7 shadow-md"
                      onClick={() => handleDownload(file.url, file.name)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7 shadow-md"
                      onClick={() => window.open(file.url, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-all cursor-pointer"
                  onClick={() => onViewDocument(file.url, file.name, file.mimeType)}
                >
                  {/* Icon or thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {file.type === "image" ? (
                      <img 
                        src={file.url} 
                        alt={file.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getFileIcon(file.type)
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.uploaderName && `${file.uploaderName} · `}
                      {format(new Date(file.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file.url, file.name);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(file.url, "_blank");
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// Helper functions
function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/");
    return decodeURIComponent(segments[segments.length - 1]) || "Unknown file";
  } catch {
    return "Unknown file";
  }
}

function getFileType(url: string, attachmentType?: string | null): "image" | "pdf" | "document" {
  if (attachmentType?.startsWith("image")) return "image";
  if (attachmentType === "pdf" || url.toLowerCase().endsWith(".pdf")) return "pdf";
  if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return "image";
  return "document";
}

function getMimeType(url: string, attachmentType?: string | null): string {
  if (attachmentType) return attachmentType;
  if (url.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (url.match(/\.jpe?g$/i)) return "image/jpeg";
  if (url.toLowerCase().endsWith(".png")) return "image/png";
  if (url.toLowerCase().endsWith(".gif")) return "image/gif";
  if (url.toLowerCase().endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export default FileManagerApp;
