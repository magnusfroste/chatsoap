/**
 * Artifact Actions Component
 * Renders action buttons for detected artifacts in AI messages
 * Enables Claude-like Artifacts UX
 */

import { Play, Eye, FileText, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DetectedArtifact, 
  isExecutableLanguage, 
  isPreviewableLanguage,
  getUniqueArtifacts 
} from "@/lib/content-detector";
import { 
  emitCodeToSandbox, 
  emitBrowserNavigate, 
  emitBrowserPreview,
  emitOpenApp,
  emitCreateNote 
} from "@/lib/canvas-apps/events";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ArtifactActionsProps {
  artifacts: DetectedArtifact[];
  className?: string;
}

export function ArtifactActions({ artifacts, className }: ArtifactActionsProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Get unique artifacts to avoid duplicate buttons
  const uniqueArtifacts = getUniqueArtifacts(artifacts);
  
  // Filter to actionable artifacts only
  const actionableArtifacts = uniqueArtifacts.filter(a => 
    a.type === 'code' || a.type === 'html' || a.type === 'url' || a.type === 'markdown-doc'
  );
  
  if (actionableArtifacts.length === 0) return null;
  
  const handleCopy = async (content: string, index: number) => {
    await navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  
  const handleOpenInSandbox = (artifact: DetectedArtifact) => {
    const lang = artifact.language === 'typescript' || artifact.language === 'ts' || artifact.language === 'tsx'
      ? 'typescript' 
      : 'javascript';
    
    emitCodeToSandbox(artifact.content, lang, false);
    emitOpenApp('code');
    toast.success("Code sent to sandbox");
  };
  
  const handlePreviewHtml = (artifact: DetectedArtifact) => {
    emitBrowserPreview(artifact.content, artifact.label);
    emitOpenApp('browser');
    toast.success("Preview opened");
  };
  
  const handleOpenUrl = (url: string) => {
    emitBrowserNavigate(url);
    emitOpenApp('browser');
    toast.success("Opening in browser");
  };
  
  const handleSaveAsNote = (artifact: DetectedArtifact) => {
    const title = artifact.type === 'code' 
      ? `Code: ${artifact.label}`
      : artifact.type === 'markdown-doc'
      ? 'AI Generated Document'
      : 'Saved Content';
    
    emitCreateNote(artifact.content, title);
    emitOpenApp('notes');
    toast.success("Opening in notes");
  };
  
  return (
    <div className={cn(
      "flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-border/30",
      className
    )}>
      {actionableArtifacts.map((artifact, index) => (
        <div key={index} className="flex items-center gap-1">
          {/* Code artifacts - Run in sandbox */}
          {artifact.type === 'code' && isExecutableLanguage(artifact.language || '') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30"
              onClick={() => handleOpenInSandbox(artifact)}
            >
              <Play className="w-3 h-3" />
              Run {artifact.label}
            </Button>
          )}
          
          {/* HTML artifacts - Preview */}
          {(artifact.type === 'html' || (artifact.type === 'code' && isPreviewableLanguage(artifact.language || ''))) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              onClick={() => handlePreviewHtml(artifact)}
            >
              <Eye className="w-3 h-3" />
              Preview {artifact.label}
            </Button>
          )}
          
          {/* URL artifacts - Open in browser */}
          {artifact.type === 'url' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
              onClick={() => handleOpenUrl(artifact.content)}
            >
              <ExternalLink className="w-3 h-3" />
              {artifact.label}
            </Button>
          )}
          
          {/* Markdown document - Save as note */}
          {artifact.type === 'markdown-doc' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
              onClick={() => handleSaveAsNote(artifact)}
            >
              <FileText className="w-3 h-3" />
              Save as Note
            </Button>
          )}
          
          {/* Copy button for code */}
          {artifact.type === 'code' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => handleCopy(artifact.content, index)}
            >
              {copiedIndex === index ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Compact artifact indicator for inline display
 */
interface ArtifactIndicatorProps {
  count: number;
  onClick?: () => void;
}

export function ArtifactIndicator({ count, onClick }: ArtifactIndicatorProps) {
  if (count === 0) return null;
  
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
    >
      <Play className="w-2.5 h-2.5" />
      {count} artifact{count > 1 ? 's' : ''}
    </button>
  );
}
