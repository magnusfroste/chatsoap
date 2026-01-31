import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wand2,
  Plus,
  Pencil,
  FileText,
  CheckSquare,
  List,
  HelpCircle,
  Languages,
  Sparkles,
  Zap,
  Loader2,
} from "lucide-react";
import { useTransformations, Transformation } from "@/hooks/useTransformations";
import { TransformationDialog } from "@/components/TransformationDialog";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "wand-2": Wand2,
  "sparkles": Sparkles,
  "file-text": FileText,
  "check-square": CheckSquare,
  "list": List,
  "help-circle": HelpCircle,
  "languages": Languages,
  "zap": Zap,
};

export function TransformationsSettingsCard() {
  const {
    transformations,
    isLoading,
    createTransformation,
    updateTransformation,
    deleteTransformation,
  } = useTransformations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransformation, setEditingTransformation] = useState<Transformation | null>(null);

  const builtInTransformations = transformations.filter((t) => t.isDefault);
  const customTransformations = transformations.filter((t) => !t.isDefault);

  const handleCreate = () => {
    setEditingTransformation(null);
    setDialogOpen(true);
  };

  const handleEdit = (transformation: Transformation) => {
    setEditingTransformation(transformation);
    setDialogOpen(true);
  };

  const handleSave = async (data: {
    name: string;
    description?: string;
    prompt: string;
    icon?: string;
  }) => {
    if (editingTransformation) {
      return await updateTransformation(editingTransformation.id, data);
    } else {
      const result = await createTransformation(data);
      return !!result;
    }
  };

  const handleDelete = async (id: string) => {
    return await deleteTransformation(id);
  };

  const getIcon = (iconName: string | undefined) => {
    const Icon = ICON_MAP[iconName || "wand-2"] || Wand2;
    return Icon;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                Transformations
              </CardTitle>
              <CardDescription>
                Reusable AI recipes for processing notes and files
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Custom Transformations */}
              {customTransformations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Your Transformations
                  </h4>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-2">
                      {customTransformations.map((t) => {
                        const Icon = getIcon(t.icon);
                        return (
                          <div
                            key={t.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 rounded-md bg-primary/10">
                                <Icon className="w-4 h-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {t.name}
                                </p>
                                {t.description && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {t.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleEdit(t)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Empty state for custom */}
              {customTransformations.length === 0 && (
                <div className="text-center py-6 border border-dashed rounded-lg">
                  <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    No custom transformations yet
                  </p>
                  <Button variant="outline" size="sm" onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-1" />
                    Create your first
                  </Button>
                </div>
              )}

              {/* Built-in Transformations */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  Built-in
                  <Badge variant="secondary" className="text-xs">
                    {builtInTransformations.length}
                  </Badge>
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {builtInTransformations.map((t) => {
                    const Icon = getIcon(t.icon);
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
                      >
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate">{t.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TransformationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transformation={editingTransformation}
        onSave={handleSave}
        onDelete={editingTransformation ? handleDelete : undefined}
      />
    </>
  );
}
