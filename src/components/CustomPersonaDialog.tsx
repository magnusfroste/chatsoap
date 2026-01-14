import { useState } from "react";
import { Plus, Sparkles, Wand2, Brain, Heart, Zap, Star, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  { id: "from-violet-500 to-fuchsia-500", label: "Lila" },
  { id: "from-rose-500 to-pink-500", label: "Rosa" },
  { id: "from-cyan-500 to-blue-500", label: "Blå" },
  { id: "from-emerald-500 to-green-500", label: "Grön" },
  { id: "from-amber-500 to-yellow-500", label: "Gul" },
  { id: "from-red-500 to-orange-500", label: "Röd" },
];

export function getIconComponent(iconId: string) {
  const found = ICON_OPTIONS.find(o => o.id === iconId);
  return found?.icon || Sparkles;
}

interface CustomPersonaDialogProps {
  onPersonaCreated: () => void;
}

export function CustomPersonaDialog({ onPersonaCreated }: CustomPersonaDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("sparkles");
  const [selectedGradient, setSelectedGradient] = useState("from-violet-500 to-fuchsia-500");

  const resetForm = () => {
    setName("");
    setDescription("");
    setSystemPrompt("");
    setSelectedIcon("sparkles");
    setSelectedGradient("from-violet-500 to-fuchsia-500");
  };

  const handleSave = async () => {
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error("Namn och systemprompt krävs");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");

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

      toast.success("Persona skapad!");
      resetForm();
      setOpen(false);
      onPersonaCreated();
    } catch (error) {
      console.error("Error creating persona:", error);
      toast.error("Kunde inte skapa persona");
    } finally {
      setSaving(false);
    }
  };

  const SelectedIconComponent = getIconComponent(selectedIcon);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Plus className="w-4 h-4" />
          Skapa egen persona
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa egen AI-persona</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${selectedGradient} flex items-center justify-center`}>
              <SelectedIconComponent className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium">{name || "Din persona"}</div>
              <p className="text-xs text-muted-foreground">
                {description || "Beskrivning..."}
              </p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Namn *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="T.ex. Min Kodexpert"
              maxLength={50}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Kort beskrivning</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="T.ex. Hjälper med JavaScript och React"
              maxLength={100}
            />
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Systemprompt *</Label>
            <Textarea
              id="prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Beskriv hur AI:n ska bete sig, t.ex: Du är en expert på JavaScript och React. Du ger alltid kodexempel och förklarar steg för steg..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Denna text skickas till AI:n för att definiera dess personlighet och beteende.
            </p>
          </div>

          {/* Icon Selection */}
          <div className="space-y-2">
            <Label>Ikon</Label>
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
            <Label>Färg</Label>
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
                Sparar...
              </>
            ) : (
              "Skapa persona"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
