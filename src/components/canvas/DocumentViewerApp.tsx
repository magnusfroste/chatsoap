import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  X, 
  Download, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut,
  Loader2,
  FileText,
  Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";

interface DocumentViewerAppProps {
  url: string;
  name: string;
  type: string;
  onClose: () => void;
}

const DocumentViewerApp = ({ url, name, type, onClose }: DocumentViewerAppProps) => {
  const [zoom, setZoom] = useState(100);
  const [isLoading, setIsLoading] = useState(true);

  const isImage = type.startsWith("image");
  const isPdf = type === "application/pdf" || url.toLowerCase().endsWith(".pdf");

  const handleDownload = async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = name;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      toast.success("Download started");
    } catch (err) {
      toast.error("Failed to download file");
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {isImage ? (
            <ImageIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
          ) : (
            <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
          )}
          <h2 className="font-medium text-sm truncate">{name}</h2>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          {isImage && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">
                {zoom}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
            </>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.open(url, "_blank")}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Document viewer */}
      <ScrollArea className="flex-1">
        <div className="min-h-full flex items-center justify-center p-4 bg-muted/30">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {isImage ? (
            <img
              src={url}
              alt={name}
              style={{ transform: `scale(${zoom / 100})` }}
              className="max-w-full h-auto rounded-lg shadow-lg transition-transform origin-center"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                toast.error("Failed to load image");
              }}
            />
          ) : isPdf ? (
            <iframe
              src={url}
              className="w-full h-[calc(100vh-200px)] min-h-[500px] rounded-lg border border-border shadow-lg"
              title={name}
              onLoad={() => setIsLoading(false)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <FileText className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                {name}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Preview not available for this file type
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Download
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Open
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default DocumentViewerApp;
