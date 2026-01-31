import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  CheckSquare,
  List,
  HelpCircle,
  Languages,
  Wand2,
  Sparkles,
  Zap,
  Loader2,
} from "lucide-react";
import { Transformation } from "@/hooks/useTransformations";

const ICON_OPTIONS = [
  { value: "wand-2", label: "Wand", icon: Wand2 },
  { value: "sparkles", label: "Sparkles", icon: Sparkles },
  { value: "file-text", label: "Document", icon: FileText },
  { value: "check-square", label: "Checklist", icon: CheckSquare },
  { value: "list", label: "List", icon: List },
  { value: "zap", label: "Zap", icon: Zap },
];

interface TransformationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transformation?: Transformation | null;
  onSave: (data: {
    name: string;
    description?: string;
    prompt: string;
    icon?: string;
  }) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
}

export function TransformationDialog({
  open,
  onOpenChange,
  transformation,
  onSave,
  onDelete,
}: TransformationDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [icon, setIcon] = useState("wand-2");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!transformation;

  useEffect(() => {
    if (transformation) {
      setName(transformation.name);
      setDescription(transformation.description || "");
      setPrompt(transformation.prompt);
      setIcon(transformation.icon || "wand-2");
    } else {
      setName("");
      setDescription("");
      setPrompt("{{content}}");
      setIcon("wand-2");
    }
  }, [transformation, open]);

  const handleSave = async () => {
    if (!name.trim() || !prompt.trim()) return;

    setSaving(true);
    const success = await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      prompt: prompt.trim(),
      icon,
    });
    setSaving(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!transformation || !onDelete) return;

    setDeleting(true);
    const success = await onDelete(transformation.id);
    setDeleting(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const SelectedIcon = ICON_OPTIONS.find((i) => i.value === icon)?.icon || Wand2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SelectedIcon className="w-5 h-5" />
            {isEditing ? "Edit Transformation" : "Create Transformation"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your custom transformation recipe."
              : "Create a reusable AI transformation. Use {{content}} as a placeholder for the input text."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Simplify Text"
              maxLength={50}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this transformation does..."
              maxLength={100}
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt Template *</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your AI prompt. Use {{content}} where the input text should go."
              rows={5}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">{"{{content}}"}</code> as a placeholder
              for the text that will be transformed.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEditing && onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="sm:mr-auto"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !prompt.trim()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEditing ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
