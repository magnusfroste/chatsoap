import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  FileText,
  CheckSquare,
  List,
  HelpCircle,
  Languages,
  Wand2,
  Loader2,
  Plus,
  Settings,
} from "lucide-react";
import { Transformation, useTransformations } from "@/hooks/useTransformations";

// Icon mapping for transformations
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "file-text": FileText,
  "check-square": CheckSquare,
  list: List,
  "help-circle": HelpCircle,
  languages: Languages,
  "wand-2": Wand2,
  sparkles: Sparkles,
};

interface TransformationsMenuProps {
  content: string;
  onResult: (result: string, transformationName: string) => void;
  onManage?: () => void;
  trigger?: React.ReactNode;
  disabled?: boolean;
}

export function TransformationsMenu({
  content,
  onResult,
  onManage,
  trigger,
  disabled = false,
}: TransformationsMenuProps) {
  const { transformations, isLoading, isProcessing, runTransformation } = useTransformations();
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("");
  const [selectedTransform, setSelectedTransform] = useState<Transformation | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleRun = async (transformation: Transformation) => {
    // Handle translate specially - needs language input
    if (transformation.name === "Translate") {
      setSelectedTransform(transformation);
      setLanguageDialogOpen(true);
      return;
    }

    setProcessingId(transformation.id);
    
    const result = await runTransformation({
      transformationId: transformation.id,
      content,
      onComplete: (fullText) => {
        onResult(fullText, transformation.name);
      },
    });

    setProcessingId(null);
  };

  const handleTranslate = async () => {
    if (!selectedTransform || !targetLanguage.trim()) return;

    setLanguageDialogOpen(false);
    setProcessingId(selectedTransform.id);

    await runTransformation({
      transformationId: selectedTransform.id,
      content,
      targetLanguage: targetLanguage.trim(),
      onComplete: (fullText) => {
        onResult(fullText, `${selectedTransform.name} (${targetLanguage})`);
      },
    });

    setProcessingId(null);
    setTargetLanguage("");
    setSelectedTransform(null);
  };

  const getIcon = (iconName: string | null) => {
    const IconComponent = iconName ? ICON_MAP[iconName] : Wand2;
    return IconComponent || Wand2;
  };

  const builtIn = transformations.filter((t) => t.isDefault);
  const custom = transformations.filter((t) => !t.isDefault);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled || isProcessing}>
          {trigger || (
            <Button variant="ghost" size="sm" className="gap-2">
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Transform
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Transformations
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isLoading ? (
            <DropdownMenuItem disabled>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading...
            </DropdownMenuItem>
          ) : (
            <>
              {/* Built-in transformations */}
              {builtIn.map((t) => {
                const Icon = getIcon(t.icon);
                const isRunning = processingId === t.id;
                return (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => handleRun(t)}
                    disabled={isProcessing}
                    className="cursor-pointer"
                  >
                    {isRunning ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4 mr-2" />
                    )}
                    <span>{t.name}</span>
                  </DropdownMenuItem>
                );
              })}

              {/* Custom transformations */}
              {custom.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Custom
                  </DropdownMenuLabel>
                  {custom.map((t) => {
                    const Icon = getIcon(t.icon);
                    const isRunning = processingId === t.id;
                    return (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => handleRun(t)}
                        disabled={isProcessing}
                        className="cursor-pointer"
                      >
                        {isRunning ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Icon className="w-4 h-4 mr-2" />
                        )}
                        <span>{t.name}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </>
              )}

              {/* Actions */}
              <DropdownMenuSeparator />
              {onManage && (
                <DropdownMenuItem onClick={onManage} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Transformations
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Language selection dialog for Translate */}
      <Dialog open={languageDialogOpen} onOpenChange={setLanguageDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="w-5 h-5" />
              Translate Content
            </DialogTitle>
            <DialogDescription>
              Enter the target language for translation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="targetLanguage">Target Language</Label>
              <Input
                id="targetLanguage"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                placeholder="e.g., Swedish, Spanish, Japanese..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLanguageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTranslate} disabled={!targetLanguage.trim()}>
              Translate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
