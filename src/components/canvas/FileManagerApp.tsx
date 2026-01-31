import { useState, useEffect, useCallback, useRef } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  Trash2,
  StickyNote,
  MoreVertical,
  FileDown,
  Upload,
  Plus,
  CheckSquare,
  Square,
  Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { CAGFile, CAGNote } from "@/hooks/useCAGContext";
import { useAuth } from "@/hooks/useAuth";
import { Note } from "@/hooks/useNotes";
import { cn } from "@/lib/utils";
import { TransformationsMenu } from "@/components/TransformationsMenu";

interface ConversationFile {
  id: string;
  url: string;
  name: string;
  type: "image" | "pdf" | "document" | "note";
  mimeType: string;
  messageId: string;
  createdAt: string;
  uploaderId: string | null;
  uploaderName: string | null;
  // New fields for unified view
  source: "attachment" | "note";
  noteContent?: string;
  noteId?: string;
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
  // Note props for unified view
  selectedCAGNotes?: CAGNote[];
  onToggleCAGNote?: (note: CAGNote) => void;
  isNoteInCAG?: (noteId: string) => boolean;
  // Callbacks for note editing
  onNoteSelect?: (note: Note) => void;
  onCreateNote?: () => void;
  // Transformation callback - creates a new note with the result
  onTransformationResult?: (result: string, title: string) => void;
}

const FileManagerApp = ({ 
  conversationId, 
  viewDocument,
  onViewDocument,
  selectedCAGFiles = [],
  onToggleCAGFile,
  isFileInCAG,
  selectedCAGNotes = [],
  onToggleCAGNote,
  isNoteInCAG,
  onNoteSelect,
  onCreateNote,
  onTransformationResult,
}: FileManagerAppProps) => {
  const { user } = useAuth();
  // Use viewDocument from registry, fall back to legacy onViewDocument
  const handleViewDocument = viewDocument || onViewDocument || ((url: string) => window.open(url, "_blank"));
  const [files, setFiles] = useState<ConversationFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [filter, setFilter] = useState<"all" | "images" | "documents" | "notes">("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<ConversationFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // File upload constants
  const ACCEPTED_TYPES = {
    image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    document: ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  };
  const ALL_ACCEPTED = [...ACCEPTED_TYPES.image, ...ACCEPTED_TYPES.document];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  // Upload file to storage
  const uploadFile = useCallback(async (file: File) => {
    // Validate file type
    if (!ALL_ACCEPTED.includes(file.type)) {
      toast.error("File type not supported. Choose image, PDF, TXT or DOCX.");
      return null;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be max 10MB");
      return null;
    }

    const getFileType = (mimeType: string) => {
      if (ACCEPTED_TYPES.image.includes(mimeType)) return "image";
      if (mimeType === "application/pdf") return "pdf";
      return "document";
    };

    const fileType = getFileType(file.type);
    const storagePath = fileType === "image" ? "chat-images" : "chat-documents";
    
    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${storagePath}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("chat-media")
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error("Failed to get public URL");
    }

    // Create message with attachment
    const { error: messageError } = await supabase
      .from("messages")
      .insert({
        content: urlData.publicUrl,
        conversation_id: conversationId,
        user_id: user?.id,
        attachment_type: file.type,
        attachment_name: file.name,
      });

    if (messageError) {
      throw messageError;
    }

    return {
      url: urlData.publicUrl,
      name: file.name,
      type: fileType,
      mimeType: file.type,
    };
  }, [conversationId, user?.id]);

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = droppedFiles.map(file => uploadFile(file));
      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(Boolean).length;
      
      if (successCount > 0) {
        toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded!`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
    }
  }, [uploadFile]);

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = selectedFiles.map(file => uploadFile(file));
      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(Boolean).length;
      
      if (successCount > 0) {
        toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded!`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [uploadFile]);

  // Helper to check if a message contains a file
  const isFileMessage = (content: string) => {
    return (
      content.includes("supabase.co/storage") ||
      content.match(/\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx)$/i)
    );
  };

  // Fetch files and notes from conversation
  useEffect(() => {
    if (!conversationId) return;

    const fetchFilesAndNotes = async () => {
      setIsLoading(true);
      try {
        // Fetch messages with attachments (exclude soft-deleted files)
        const messagesPromise = supabase
          .from("messages")
          .select("id, content, created_at, user_id, attachment_type, attachment_name, is_attachment_deleted")
          .eq("conversation_id", conversationId)
          .eq("is_attachment_deleted", false)
          .order("created_at", { ascending: false });

        // Fetch notes for current user
        const notesPromise = user?.id
          ? supabase
              .from("notes")
              .select("*")
              .eq("user_id", user.id)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [], error: null });

        const [messagesResult, notesResult] = await Promise.all([messagesPromise, notesPromise]);

        if (messagesResult.error) throw messagesResult.error;

        const messages = messagesResult.data || [];
        const notes = notesResult.data || [];

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
        const attachmentFiles: ConversationFile[] = fileMessages.map((msg) => {
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
            source: "attachment" as const,
          };
        });

        // Convert notes to ConversationFile format
        const noteFiles: ConversationFile[] = notes.map((note: any) => ({
          id: `note-${note.id}`,
          url: "",
          name: `${note.title || "Untitled"}.md`,
          type: "note" as const,
          mimeType: "text/markdown",
          messageId: "",
          createdAt: note.updated_at || note.created_at,
          uploaderId: note.user_id,
          uploaderName: user?.email?.split("@")[0] || "You",
          source: "note" as const,
          noteContent: note.content,
          noteId: note.id,
        }));

        // Combine and sort by date
        const allFiles = [...attachmentFiles, ...noteFiles].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setFiles(allFiles);
      } catch (err) {
        console.error("Failed to fetch files:", err);
        toast.error("Failed to load files");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilesAndNotes();

    // Subscribe to new messages with attachments
    const messageChannel = supabase
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
            source: "attachment",
          };

          // Add to beginning of list (newest first)
          setFiles((prev) => {
            if (prev.find((f) => f.id === newMsg.id)) return prev;
            return [newFile, ...prev];
          });
        }
      )
      .subscribe();

    // Subscribe to notes changes
    const notesChannel = user?.id
      ? supabase
          .channel(`notes-files-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notes",
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              if (payload.eventType === "INSERT") {
                const note = payload.new as any;
                const newNoteFile: ConversationFile = {
                  id: `note-${note.id}`,
                  url: "",
                  name: `${note.title || "Untitled"}.md`,
                  type: "note",
                  mimeType: "text/markdown",
                  messageId: "",
                  createdAt: note.updated_at || note.created_at,
                  uploaderId: note.user_id,
                  uploaderName: user?.email?.split("@")[0] || "You",
                  source: "note",
                  noteContent: note.content,
                  noteId: note.id,
                };
                setFiles((prev) => [newNoteFile, ...prev]);
              } else if (payload.eventType === "UPDATE") {
                const note = payload.new as any;
                setFiles((prev) =>
                  prev.map((f) =>
                    f.noteId === note.id
                      ? {
                          ...f,
                          name: `${note.title || "Untitled"}.md`,
                          noteContent: note.content,
                          createdAt: note.updated_at || note.created_at,
                        }
                      : f
                  )
                );
              } else if (payload.eventType === "DELETE") {
                const note = payload.old as any;
                setFiles((prev) => prev.filter((f) => f.noteId !== note.id));
              }
            }
          )
          .subscribe()
      : null;

    return () => {
      supabase.removeChannel(messageChannel);
      if (notesChannel) supabase.removeChannel(notesChannel);
    };
  }, [conversationId, user?.id]);

  // Filter files
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.noteContent?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    const matchesFilter = 
      filter === "all" ||
      (filter === "images" && file.type === "image") ||
      (filter === "documents" && (file.type === "pdf" || file.type === "document")) ||
      (filter === "notes" && file.type === "note");
    return matchesSearch && matchesFilter;
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case "image":
        return <ImageIcon className="w-5 h-5 text-blue-500" />;
      case "pdf":
        return <FileText className="w-5 h-5 text-red-500" />;
      case "note":
        return <StickyNote className="w-5 h-5 text-yellow-500" />;
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

  // Download note as markdown
  const handleDownloadNote = (file: ConversationFile) => {
    if (!file.noteContent) return;
    const blob = new Blob([file.noteContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown");
  };

  // Export note as PDF (using print)
  const handleExportPDF = (file: ConversationFile) => {
    if (!file.noteContent) return;
    
    // Create a styled print window
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Pop-up blocked. Please allow pop-ups.");
      return;
    }

    const title = file.name.replace(".md", "");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              line-height: 1.6;
              color: #333;
            }
            h1 { font-size: 24px; margin-bottom: 16px; }
            h2 { font-size: 20px; margin-top: 24px; }
            h3 { font-size: 18px; }
            code {
              background: #f4f4f4;
              padding: 2px 6px;
              border-radius: 4px;
              font-family: 'SF Mono', Monaco, monospace;
            }
            pre {
              background: #f4f4f4;
              padding: 16px;
              border-radius: 8px;
              overflow-x: auto;
            }
            pre code { background: none; padding: 0; }
            blockquote {
              border-left: 3px solid #ddd;
              margin: 0;
              padding-left: 16px;
              color: #666;
            }
            @media print {
              body { margin: 0; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div style="white-space: pre-wrap;">${file.noteContent}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    
    // Trigger print dialog
    setTimeout(() => {
      printWindow.print();
    }, 250);
    
    toast.success("Print dialog opened - Save as PDF");
  };

  // Handle file click
  const handleFileClick = (file: ConversationFile) => {
    if (file.source === "note" && file.noteId) {
      // Open note editor
      if (onNoteSelect) {
        // Convert back to Note format
        const note: Note = {
          id: file.noteId,
          user_id: file.uploaderId || "",
          conversation_id: conversationId,
          room_id: null,
          source_message_id: null,
          title: file.name.replace(".md", ""),
          content: file.noteContent || "",
          created_at: file.createdAt,
          updated_at: file.createdAt,
        };
        onNoteSelect(note);
      }
    } else {
      // Open document viewer for attachments
      handleViewDocument(file.url, file.name, file.mimeType);
    }
  };

  // Delete file (soft delete) or note
  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    
    setIsDeleting(true);
    try {
      if (fileToDelete.source === "note" && fileToDelete.noteId) {
        // Delete note
        const { error } = await supabase
          .from("notes")
          .delete()
          .eq("id", fileToDelete.noteId);
        
        if (error) throw error;
        
        // Remove from local state
        setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
        toast.success("Note deleted");
      } else {
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
        toast.success("File removed");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Could not delete");
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

  // Helper to convert note file to CAGNote format
  const toCAGNote = (file: ConversationFile): CAGNote => ({
    id: file.noteId || file.id,
    title: file.name.replace(".md", ""),
    content: file.noteContent || "",
  });

  // Get content for transformation
  const getFileContentForTransformation = (file: ConversationFile): string => {
    if (file.source === "note") {
      return file.noteContent || "";
    }
    // For attachments, we'd need to fetch content - for now use the URL as placeholder
    return `[File: ${file.name}]\nURL: ${file.url}`;
  };

  // Handle transformation result - create a new note
  const handleTransformationResult = async (result: string, transformationName: string, file: ConversationFile) => {
    if (onTransformationResult) {
      const title = `${transformationName}: ${file.name.replace(".md", "")}`;
      onTransformationResult(result, title);
    } else {
      // Fallback: create note directly
      if (!user?.id) {
        toast.error("You must be logged in");
        return;
      }
      
      try {
        const title = `${transformationName}: ${file.name.replace(".md", "")}`;
        const { error } = await supabase
          .from("notes")
          .insert({
            user_id: user.id,
            title,
            content: result,
            conversation_id: conversationId,
          });
        
        if (error) throw error;
        toast.success("Note created from transformation");
      } catch (err) {
        console.error("Failed to create note:", err);
        toast.error("Failed to create note");
      }
    }
  };

  const cagFileCount = selectedCAGFiles?.length || 0;
  const cagNoteCount = selectedCAGNotes?.length || 0;
  const totalInContext = cagFileCount + cagNoteCount;

  // Count by type
  const imageCount = files.filter(f => f.type === "image").length;
  const docCount = files.filter(f => f.type === "pdf" || f.type === "document").length;
  const noteCount = files.filter(f => f.type === "note").length;

  // Select all / deselect all handlers
  const handleSelectAll = () => {
    filteredFiles.forEach((file) => {
      if (file.source === "note" && file.noteId) {
        const isSelected = isNoteInCAG?.(file.noteId);
        if (!isSelected && onToggleCAGNote) {
          onToggleCAGNote(toCAGNote(file));
        }
      } else if (file.source === "attachment") {
        const isSelected = isFileInCAG?.(file.id);
        if (!isSelected && onToggleCAGFile) {
          onToggleCAGFile(toCAGFile(file));
        }
      }
    });
    toast.success(`${filteredFiles.length} items added to context`);
  };

  const handleDeselectAll = () => {
    filteredFiles.forEach((file) => {
      if (file.source === "note" && file.noteId) {
        const isSelected = isNoteInCAG?.(file.noteId);
        if (isSelected && onToggleCAGNote) {
          onToggleCAGNote(toCAGNote(file));
        }
      } else if (file.source === "attachment") {
        const isSelected = isFileInCAG?.(file.id);
        if (isSelected && onToggleCAGFile) {
          onToggleCAGFile(toCAGFile(file));
        }
      }
    });
    toast.success("All items removed from context");
  };

  // Check if all filtered files are selected
  const allSelected = filteredFiles.length > 0 && filteredFiles.every((file) => {
    if (file.source === "note" && file.noteId) {
      return isNoteInCAG?.(file.noteId);
    }
    return isFileInCAG?.(file.id);
  });

  return (
    <div 
      className="h-full flex flex-col relative min-w-0 overflow-hidden"
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.txt,.docx"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Upload className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="text-lg font-medium text-primary">Drop files here</p>
            <p className="text-sm text-muted-foreground mt-1">Images, PDFs, TXT, DOCX</p>
          </div>
        </div>
      )}

      {/* Upload overlay */}
      {isUploading && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-10 w-10 text-primary mx-auto mb-3 animate-spin" />
            <p className="text-sm font-medium">Uploading...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <FolderOpen className="h-5 w-5 text-primary flex-shrink-0" />
            <h2 className="font-semibold text-foreground truncate">Files</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">
              {files.length}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {totalInContext > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs flex-shrink-0">
                <Sparkles className="w-3 h-3" />
                {totalInContext}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 w-8 flex-shrink-0"
              disabled={isUploading}
              title="Upload files"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
            {onCreateNote && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCreateNote}
                className="h-8 w-8 flex-shrink-0"
                title="New note"
              >
                <StickyNote className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 flex-shrink-0"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 flex-shrink-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files and notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/50"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 flex-wrap min-w-0">
          <Badge
            variant={filter === "all" ? "default" : "outline"}
            className="cursor-pointer flex-shrink-0"
            onClick={() => setFilter("all")}
          >
            All
          </Badge>
          <Badge
            variant={filter === "notes" ? "default" : "outline"}
            className="cursor-pointer flex-shrink-0"
            onClick={() => setFilter("notes")}
          >
            <StickyNote className="w-3 h-3 mr-1" />
            {noteCount}
          </Badge>
          <Badge
            variant={filter === "images" ? "default" : "outline"}
            className="cursor-pointer flex-shrink-0"
            onClick={() => setFilter("images")}
          >
            <ImageIcon className="w-3 h-3 mr-1" />
            {imageCount}
          </Badge>
          <Badge
            variant={filter === "documents" ? "default" : "outline"}
            className="cursor-pointer flex-shrink-0"
            onClick={() => setFilter("documents")}
          >
            <FileText className="w-3 h-3 mr-1" />
            {docCount}
          </Badge>
        </div>

        {/* CAG actions bar */}
        {(onToggleCAGFile || onToggleCAGNote) && filteredFiles.length > 0 && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10 min-w-0">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-xs text-muted-foreground truncate">
                {totalInContext > 0 ? `${totalInContext} selected` : "Select for AI"}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                disabled={allSelected}
                className="h-7 text-xs px-2"
                title="Select all"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeselectAll}
                disabled={totalInContext === 0}
                className="h-7 text-xs px-2"
                title="Deselect all"
              >
                <Square className="w-3.5 h-3.5" />
              </Button>
            </div>
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
                {searchQuery ? (
                  <Search className="h-8 w-8 text-muted-foreground/50" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                )}
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery ? "No matching files" : "No files yet"}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[250px]">
                {searchQuery 
                  ? "Try a different search term" 
                  : "Drag and drop files here, or use the upload button"}
              </p>
              {!searchQuery && (
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload files
                  </Button>
                  {onCreateNote && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onCreateNote}
                    >
                      <StickyNote className="h-4 w-4 mr-2" />
                      Create note
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {filteredFiles.map((file) => {
                const isInCAG = file.source === "note" 
                  ? isNoteInCAG?.(file.noteId || "") || false
                  : isFileInCAG?.(file.id) || false;
                
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
                    {(file.source === "note" ? onToggleCAGNote : onToggleCAGFile) && (
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
                          onClick={() => {
                            if (file.source === "note") {
                              onToggleCAGNote?.(toCAGNote(file));
                            } else {
                              onToggleCAGFile?.(toCAGFile(file));
                            }
                          }}
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
                      onClick={() => handleFileClick(file)}
                    >
                      {file.type === "image" ? (
                        <img 
                          src={file.url} 
                          alt={file.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : file.type === "note" ? (
                        <div className="w-full h-full p-3 flex flex-col">
                          <StickyNote className="w-6 h-6 text-yellow-500 mb-2" />
                          <p className="text-xs text-muted-foreground line-clamp-4">
                            {file.noteContent?.slice(0, 100) || "Empty note"}
                          </p>
                        </div>
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
                      {/* Transformation Quick Action for notes */}
                      {file.source === "note" && file.noteContent && (
                        <TransformationsMenu
                          content={file.noteContent}
                          onResult={(result, transformName) => handleTransformationResult(result, transformName, file)}
                          trigger={
                            <Button variant="secondary" size="icon" className="h-7 w-7 shadow-md">
                              <Wand2 className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          }
                        />
                      )}
                      
                      {file.source === "note" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="secondary" size="icon" className="h-7 w-7 shadow-md">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadNote(file)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download .md
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportPDF(file)}>
                              <FileDown className="h-4 w-4 mr-2" />
                              Export as PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => confirmDelete(file)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => {
                const isInCAG = file.source === "note"
                  ? isNoteInCAG?.(file.noteId || "") || false
                  : isFileInCAG?.(file.id) || false;
                
                return (
                  <div
                    key={file.id}
                    className={`group flex items-center gap-3 p-3 rounded-lg border bg-card transition-all cursor-pointer min-w-0 ${
                      isInCAG 
                        ? "border-primary/50 ring-1 ring-primary/20" 
                        : "border-border hover:border-primary/30"
                    }`}
                    onClick={() => handleFileClick(file)}
                  >
                    {/* CAG Checkbox */}
                    {(file.source === "note" ? onToggleCAGNote : onToggleCAGFile) && (
                      <div 
                        className={`flex items-center justify-center w-8 h-8 rounded-md transition-all cursor-pointer flex-shrink-0 ${
                          isInCAG 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted/50 border border-border hover:border-primary/30"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (file.source === "note") {
                            onToggleCAGNote?.(toCAGNote(file));
                          } else {
                            onToggleCAGFile?.(toCAGFile(file));
                          }
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
                        {file.source === "note" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Note
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {file.uploaderName && `${file.uploaderName} · `}
                        {format(new Date(file.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {/* Transformation Quick Action - only for notes (they have content) */}
                      {file.source === "note" && file.noteContent && (
                        <TransformationsMenu
                          content={file.noteContent}
                          onResult={(result, transformName) => handleTransformationResult(result, transformName, file)}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Wand2 className="h-4 w-4 text-primary" />
                            </Button>
                          }
                        />
                      )}
                      
                      {file.source === "note" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadNote(file)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download .md
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportPDF(file)}>
                              <FileDown className="h-4 w-4 mr-2" />
                              Export as PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => confirmDelete(file)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <>
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
                        </>
                      )}
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
            <AlertDialogTitle>
              {fileToDelete?.source === "note" ? "Delete note?" : "Remove file?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {fileToDelete?.source === "note" 
                ? `The note "${fileToDelete?.name.replace(".md", "")}" will be permanently deleted.`
                : `The file "${fileToDelete?.name}" will be removed. The message in chat will show "File removed" instead.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFile}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
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
