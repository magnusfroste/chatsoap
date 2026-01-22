import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Sparkles,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { CAGFile } from "@/hooks/useCAGContext";

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
  // From CanvasAppProps (registry)
  viewDocument?: (url: string, name: string, type: string) => void;
  // Legacy prop name (for backwards compatibility)
  onViewDocument?: (url: string, name: string, type: string) => void;
  // CAG props
  selectedCAGFiles?: CAGFile[];
  onToggleCAGFile?: (file: CAGFile) => void;
  isFileInCAG?: (fileId: string) => boolean;
}

const FileManagerApp = ({ 
  conversationId, 
  viewDocument,
  onViewDocument,
  selectedCAGFiles = [],
  onToggleCAGFile,
  isFileInCAG,
}: FileManagerAppProps) => {
  // Use viewDocument from registry, fall back to legacy onViewDocument
  const handleViewDocument = viewDocument || onViewDocument || ((url: string) => window.open(url, "_blank"));
  const [files, setFiles] = useState<ConversationFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<"all" | "images" | "documents">("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<ConversationFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper to check if a message contains a file
  const isFileMessage = (content: string) => {
    return (
      content.includes("supabase.co/storage") ||
      content.match(/\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx)$/i)
    );
  };

  // Fetch files from conversation messages
  useEffect(() => {
    if (!conversationId) return;

    const fetchFiles = async () => {
      setIsLoading(true);
      try {
        // Fetch messages with attachments (exclude soft-deleted files)
        const { data: messages, error } = await supabase
          .from("messages")
          .select("id, content, created_at, user_id, attachment_type, attachment_name, is_attachment_deleted")
          .eq("conversation_id", conversationId)
          .eq("is_attachment_deleted", false)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Filter messages that contain file URLs
        const fileMessages = messages?.filter((msg) => isFileMessage(msg.content)) || [];

        // Get user profiles for uploaders
        const userIds = [...new Set(fileMessages.map(m => m.user_id).filter(Boolean))];
        let profileMap = new Map<string, string>();
        
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", userIds);
          profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
        }

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

    // Subscribe to new messages with attachments
    const channel = supabase
      .channel(`files-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          
          // Only process if it's a file message
          if (!isFileMessage(newMsg.content)) return;

          // Skip if already in list
          setFiles((prev) => {
            if (prev.find((f) => f.id === newMsg.id)) return prev;
            return prev;
          });

          // Fetch uploader profile
          let uploaderName: string | null = null;
          if (newMsg.user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("user_id", newMsg.user_id)
              .single();
            uploaderName = profile?.display_name || "User";
          }

          const newFile: ConversationFile = {
            id: newMsg.id,
            url: newMsg.content,
            name: newMsg.attachment_name || getFilenameFromUrl(newMsg.content),
            type: getFileType(newMsg.content, newMsg.attachment_type),
            mimeType: getMimeType(newMsg.content, newMsg.attachment_type),
            messageId: newMsg.id,
            createdAt: newMsg.created_at,
            uploaderId: newMsg.user_id,
            uploaderName,
          };

          // Add to beginning of list (newest first)
          setFiles((prev) => {
            if (prev.find((f) => f.id === newMsg.id)) return prev;
            return [newFile, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  // Delete file (soft delete)
  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    
    setIsDeleting(true);
    try {
      // Extract the file path from the URL for storage deletion
      const url = new URL(fileToDelete.url);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/chat-media\/(.+)/);
      const filePath = pathMatch ? pathMatch[1] : null;

      // Delete from storage if we can extract the path
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from("chat-media")
          .remove([filePath]);
        
        if (storageError) {
          console.error("Storage delete error:", storageError);
          // Continue with soft delete even if storage deletion fails
        }
      }

      // Soft delete: mark the message as having deleted attachment
      const { error: updateError } = await supabase
        .from("messages")
        .update({ is_attachment_deleted: true })
        .eq("id", fileToDelete.messageId);

      if (updateError) throw updateError;

      // Remove from local state
      setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      
      toast.success("Fil borttagen");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Kunde inte ta bort filen");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  const confirmDelete = (file: ConversationFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  // Helper to convert file to CAGFile format
  const toCAGFile = (file: ConversationFile): CAGFile => ({
    id: file.id,
    url: file.url,
    name: file.name,
    mimeType: file.mimeType,
    messageId: file.messageId,
  });

  const cagFileCount = selectedCAGFiles?.length || 0;

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
            {cagFileCount > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Sparkles className="w-3 h-3" />
                {cagFileCount} in context
              </Badge>
            )}
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

        {/* CAG info banner */}
        {onToggleCAGFile && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Select files to include in AI context when using @ai
            </p>
          </div>
        )}
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
              {filteredFiles.map((file) => {
                const isInCAG = isFileInCAG?.(file.id) || false;
                return (
                  <div
                    key={file.id}
                    className={`group relative rounded-xl border bg-card overflow-hidden transition-all ${
                      isInCAG 
                        ? "border-primary/50 ring-1 ring-primary/20" 
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    {/* CAG Checkbox */}
                    {onToggleCAGFile && (
                      <div 
                        className="absolute top-2 left-2 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div 
                          className={`flex items-center justify-center w-6 h-6 rounded-md transition-all cursor-pointer ${
                            isInCAG 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-background/80 backdrop-blur-sm border border-border opacity-0 group-hover:opacity-100"
                          }`}
                          onClick={() => onToggleCAGFile(toCAGFile(file))}
                        >
                          {isInCAG ? (
                            <Sparkles className="w-3.5 h-3.5" />
                          ) : (
                            <Checkbox 
                              checked={false} 
                              className="border-0 data-[state=checked]:bg-transparent"
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Preview */}
                    <div 
                      className="aspect-square bg-muted/50 flex items-center justify-center cursor-pointer"
                      onClick={() => handleViewDocument(file.url, file.name, file.mimeType)}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file.url, file.name);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7 shadow-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(file.url, "_blank");
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7 shadow-md text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(file);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => {
                const isInCAG = isFileInCAG?.(file.id) || false;
                return (
                  <div
                    key={file.id}
                    className={`group flex items-center gap-3 p-3 rounded-lg border bg-card transition-all cursor-pointer ${
                      isInCAG 
                        ? "border-primary/50 ring-1 ring-primary/20" 
                        : "border-border hover:border-primary/30"
                    }`}
                    onClick={() => handleViewDocument(file.url, file.name, file.mimeType)}
                  >
                    {/* CAG Checkbox */}
                    {onToggleCAGFile && (
                      <div 
                        className={`flex items-center justify-center w-8 h-8 rounded-md transition-all cursor-pointer flex-shrink-0 ${
                          isInCAG 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted/50 border border-border hover:border-primary/30"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCAGFile(toCAGFile(file));
                        }}
                      >
                        {isInCAG ? (
                          <Sparkles className="w-4 h-4" />
                        ) : (
                          <Checkbox 
                            checked={false} 
                            className="border-0"
                          />
                        )}
                      </div>
                    )}

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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        {isInCAG && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                            AI
                          </Badge>
                        )}
                      </div>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(file);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort fil?</AlertDialogTitle>
            <AlertDialogDescription>
              Filen "{fileToDelete?.name}" kommer tas bort permanent. 
              Meddelandet i chatten kommer visa "Fil borttagen" istället.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFile}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Tar bort...
                </>
              ) : (
                "Ta bort"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith(".pdf")) return "application/pdf";
  if (url.match(/\.jpe?g$/i)) return "image/jpeg";
  if (lowerUrl.endsWith(".png")) return "image/png";
  if (lowerUrl.endsWith(".gif")) return "image/gif";
  if (lowerUrl.endsWith(".webp")) return "image/webp";
  // Office documents
  if (lowerUrl.endsWith(".doc")) return "application/msword";
  if (lowerUrl.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lowerUrl.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lowerUrl.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lowerUrl.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lowerUrl.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (lowerUrl.endsWith(".rtf")) return "application/rtf";
  return "application/octet-stream";
}

export default FileManagerApp;
