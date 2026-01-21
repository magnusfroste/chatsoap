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
  Image as ImageIcon,
  Maximize2,
  RotateCw
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
  const [pdfLoadError, setPdfLoadError] = useState(false);

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
  const handleResetZoom = () => setZoom(100);

  // Use Google Docs Viewer as fallback for PDFs (more reliable in iframes)
  const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

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
          {/* Zoom controls for images */}
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
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground min-w-[48px]"
                onClick={handleResetZoom}
              >
                {zoom}%
              </Button>
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
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.open(url, "_blank")}
            title="Open in new tab"
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
      <div className="flex-1 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Loading document...</span>
            </div>
          </div>
        )}
        
        {isImage ? (
          <ScrollArea className="h-full">
            <div className="min-h-full flex items-center justify-center p-4 bg-muted/30">
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
            </div>
          </ScrollArea>
        ) : isPdf ? (
          <div className="h-full w-full bg-muted/30">
            {pdfLoadError ? (
              // Fallback UI when PDF can't be embedded
              <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <FileText className="h-10 w-10 text-red-500/70" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {name}
                </p>
                <p className="text-xs text-muted-foreground mb-4 max-w-[300px]">
                  PDF preview is not available in the embedded viewer. Use the buttons below to view or download.
                </p>
                <div className="flex gap-2">
                  <Button variant="default" size="sm" onClick={() => window.open(url, "_blank")}>
                    <Maximize2 className="h-4 w-4 mr-1.5" />
                    Open in browser
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Download
                  </Button>
                </div>
              </div>
            ) : (
              // Try native PDF embed first, then Google Docs viewer
              <object
                data={url}
                type="application/pdf"
                className="w-full h-full"
                onLoad={() => setIsLoading(false)}
              >
                {/* Fallback to iframe with Google Docs Viewer */}
                <iframe
                  src={googleDocsViewerUrl}
                  className="w-full h-full border-0"
                  title={name}
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setPdfLoadError(true);
                  }}
                />
              </object>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
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
    </div>
  );
};

export default DocumentViewerApp;
