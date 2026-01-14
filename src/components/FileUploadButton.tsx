import { useState, useRef } from "react";
import { Paperclip, Image, FileText, File, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  url: string;
  name: string;
  type: string;
  mimeType: string;
}

interface FileUploadButtonProps {
  onFileSelect: (file: UploadedFile) => void;
  className?: string;
}

const ACCEPTED_TYPES = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  document: ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

const ALL_ACCEPTED = [...ACCEPTED_TYPES.image, ...ACCEPTED_TYPES.document];
const ACCEPT_STRING = "image/*,application/pdf,.txt,.docx";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const FileUploadButton = ({ onFileSelect, className }: FileUploadButtonProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const getFileType = (mimeType: string): UploadedFile["type"] => {
    if (ACCEPTED_TYPES.image.includes(mimeType)) return "image";
    if (mimeType === "application/pdf") return "pdf";
    return "document";
  };

  const getStoragePath = (type: string) => {
    return type === "image" ? "chat-images" : "chat-documents";
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALL_ACCEPTED.includes(file.type)) {
      toast.error("Filtypen stöds inte. Välj bild, PDF, TXT eller DOCX.");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Filen får vara max 10MB");
      return;
    }

    setIsUploading(true);
    setOpen(false);

    try {
      const fileType = getFileType(file.type);
      const storagePath = getStoragePath(fileType);
      
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

      if (urlData?.publicUrl) {
        onFileSelect({
          url: urlData.publicUrl,
          name: file.name,
          type: fileType,
          mimeType: file.type,
        });
        toast.success(fileType === "image" ? "Bild uppladdad!" : "Dokument uppladdat!");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Kunde inte ladda upp filen");
    } finally {
      setIsUploading(false);
      // Reset inputs
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const triggerImageInput = () => {
    imageInputRef.current?.click();
    setOpen(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
    setOpen(false);
  };

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isUploading}
            className={cn("flex-shrink-0 text-muted-foreground hover:text-foreground rounded-full", className)}
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start" side="top" sideOffset={8}>
          <div className="space-y-1">
            <button
              onClick={triggerImageInput}
              className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-muted transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Image className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm font-medium">Bild</span>
            </button>
            <button
              onClick={triggerFileInput}
              className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-muted transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <span className="text-sm font-medium block">Dokument</span>
                <span className="text-xs text-muted-foreground">PDF, TXT, DOCX</span>
              </div>
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
};

interface FilePreviewProps {
  file: UploadedFile;
  onRemove: () => void;
  showAnalyzeHint?: boolean;
}

export const FilePreview = ({ file, onRemove, showAnalyzeHint }: FilePreviewProps) => {
  const isImage = file.type === "image";
  
  const FileIcon = file.type === "pdf" ? FileText : File;
  
  return (
    <div className="relative inline-block">
      {isImage ? (
        <img
          src={file.url}
          alt={file.name}
          className="max-w-[200px] max-h-[150px] rounded-lg object-cover"
        />
      ) : (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-[250px]">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <FileIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.type === "pdf" ? "PDF" : "Dokument"}
            </p>
            {showAnalyzeHint && (
              <p className="text-xs text-primary mt-1">Skriv @ai för att analysera</p>
            )}
          </div>
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
