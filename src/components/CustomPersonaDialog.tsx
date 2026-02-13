import { useState, useEffect } from "react";
import { Sparkles, Wand2, Brain, Heart, Zap, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ICON_OPTIONS = [
  { id: "sparkles", icon: Sparkles, label: "Sparkles" },
  { id: "wand2", icon: Wand2, label: "Wand" },
  { id: "brain", icon: Brain, label: "Brain" },
  { id: "heart", icon: Heart, label: "Heart" },
  { id: "zap", icon: Zap, label: "Zap" },
  { id: "star", icon: Star, label: "Star" },
];

const GRADIENT_OPTIONS = [
  { id: "from-violet-500 to-fuchsia-500", label: "Purple" },
  { id: "from-rose-500 to-pink-500", label: "Pink" },
  { id: "from-cyan-500 to-blue-500", label: "Blue" },
  { id: "from-emerald-500 to-green-500", label: "Green" },
  { id: "from-amber-500 to-yellow-500", label: "Yellow" },
  { id: "from-red-500 to-orange-500", label: "Red" },
];

export function getIconComponent(iconId: string) {
  const found = ICON_OPTIONS.find(o => o.id === iconId);
  return found?.icon || Sparkles;
}

export interface EditablePersona {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  icon: string;
  gradient: string;
}

interface CustomPersonaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPersonaSaved: () => void;
  editingPersona?: EditablePersona | null;
}

export function CustomPersonaDialog({ open, onOpenChange, onPersonaSaved, editingPersona }: CustomPersonaDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("sparkles");
  const [selectedGradient, setSelectedGradient] = useState("from-violet-500 to-fuchsia-500");

  const isEditing = !!editingPersona;

  // Populate form when editing
  useEffect(() => {
    if (editingPersona) {
      setName(editingPersona.name);
      setDescription(editingPersona.description || "");
      setSystemPrompt(editingPersona.system_prompt);
      setSelectedIcon(editingPersona.icon || "sparkles");
      setSelectedGradient(editingPersona.gradient || "from-violet-500 to-fuchsia-500");
    } else {
      resetForm();
    }
  }, [editingPersona, open]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setSystemPrompt("");
    setSelectedIcon("sparkles");
    setSelectedGradient("from-violet-500 to-fuchsia-500");
  };

  const handleSave = async () => {
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error("Name and system prompt are required");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      if (isEditing) {
        // Update existing persona
        const { error } = await supabase
          .from("custom_personas")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            system_prompt: systemPrompt.trim(),
            icon: selectedIcon,
            gradient: selectedGradient,
          })
          .eq("id", editingPersona.id)
          .eq("user_id", user.id);

        if (error) throw error;
        toast.success("Persona updated!");
      } else {
        // Create new persona
        const { error } = await supabase
          .from("custom_personas")
          .insert({
            user_id: user.id,
            name: name.trim(),
            description: description.trim() || null,
            system_prompt: systemPrompt.trim(),
            icon: selectedIcon,
            gradient: selectedGradient,
          });

        if (error) throw error;
        toast.success("Persona created!");
      }

      resetForm();
      onPersonaSaved();
    } catch (error) {
      console.error("Error saving persona:", error);
      toast.error(isEditing ? "Could not update persona" : "Could not create persona");
    } finally {
      setSaving(false);
    }
  };

  const SelectedIconComponent = getIconComponent(selectedIcon);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit AI Persona" : "Create Custom AI Persona"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update persona settings" : "Define a custom AI personality"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${selectedGradient} flex items-center justify-center`}>
              <SelectedIconComponent className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium">{name || "Your persona"}</div>
              <p className="text-xs text-muted-foreground">
                {description || "Description..."}
              </p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Code Expert"
              maxLength={50}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Short description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Helps with JavaScript and React"
              maxLength={100}
            />
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">System prompt *</Label>
            <Textarea
              id="prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Describe how the AI should behave, e.g.: You are an expert in JavaScript and React. You always provide code examples and explain step by step..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This text is sent to the AI to define its personality and behavior.
            </p>
          </div>

          {/* Icon Selection */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex gap-2 flex-wrap">
              {ICON_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedIcon(option.id)}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                      selectedIcon === option.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gradient Selection */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {GRADIENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedGradient(option.id)}
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${option.id} transition-all ${
                    selectedGradient === option.id
                      ? "ring-2 ring-primary ring-offset-2"
                      : ""
                  }`}
                  title={option.label}
                />
              ))}
            </div>
          </div>

          {/* Save Button */}
          <Button 
            onClick={handleSave} 
            disabled={saving || !name.trim() || !systemPrompt.trim()}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              isEditing ? "Save changes" : "Create persona"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
