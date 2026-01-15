import { useState, useEffect } from "react";
import { Bot, Code, Pen, Lightbulb, GraduationCap, ChevronDown, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CustomPersonaDialog, getIconComponent } from "./CustomPersonaDialog";

// AI Personas - shared definition
export const AI_PERSONAS = [
  {
    id: "general",
    name: "Generell Assistent",
    description: "Hjälpsam AI för alla typer av frågor",
    icon: Bot,
    gradient: "from-primary to-accent",
  },
  {
    id: "code",
    name: "Kodhjälp",
    description: "Expert på programmering och felsökning",
    icon: Code,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    id: "writer",
    name: "Skrivassistent",
    description: "Hjälper med texter och kommunikation",
    icon: Pen,
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    id: "creative",
    name: "Kreativ Brainstorming",
    description: "Genererar idéer och tänker utanför boxen",
    icon: Lightbulb,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    id: "learning",
    name: "Lärare & Mentor",
    description: "Pedagogiska förklaringar anpassade för dig",
    icon: GraduationCap,
    gradient: "from-purple-500 to-pink-500",
  },
];

export interface CustomPersona {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  icon: string;
  gradient: string;
}

interface PersonaSwitcherProps {
  conversationId: string;
  currentPersona: string | null | undefined;
  onPersonaChange: (persona: string, customSystemPrompt?: string) => void;
}

export function PersonaSwitcher({ conversationId, currentPersona, onPersonaChange }: PersonaSwitcherProps) {
  const [updating, setUpdating] = useState(false);
  const [customPersonas, setCustomPersonas] = useState<CustomPersona[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Check if current persona is a custom one
  const isCustomPersona = currentPersona?.startsWith("custom:");
  const customPersonaId = isCustomPersona ? currentPersona.replace("custom:", "") : null;
  const currentCustomPersona = customPersonas.find(p => p.id === customPersonaId);
  
  const currentBuiltInPersona = AI_PERSONAS.find(p => p.id === currentPersona);
  const currentPersonaData = currentCustomPersona || currentBuiltInPersona || AI_PERSONAS[0];
  
  const CurrentIcon = currentCustomPersona 
    ? getIconComponent(currentCustomPersona.icon)
    : (currentBuiltInPersona?.icon || AI_PERSONAS[0].icon);

  useEffect(() => {
    fetchCustomPersonas();
  }, []);

  const fetchCustomPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from("custom_personas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomPersonas(data || []);
    } catch (error) {
      console.error("Error fetching custom personas:", error);
    } finally {
      setLoadingCustom(false);
    }
  };

  const handlePersonaChange = async (personaId: string, customSystemPrompt?: string) => {
    if (updating) return;
    
    // Close dropdown immediately for better UX
    setDropdownOpen(false);
    
    // Allow re-selecting the same persona (no early return)
    setUpdating(true);
    try {
      const isCustom = personaId.startsWith("custom:");
      const displayName = isCustom 
        ? customPersonas.find(p => p.id === personaId.replace("custom:", ""))?.name
        : AI_PERSONAS.find(p => p.id === personaId)?.name;
      
      const { error } = await supabase
        .from("conversations")
        .update({ 
          persona: personaId,
          name: displayName || "AI Assistent"
        })
        .eq("id", conversationId);

      if (error) throw error;
      
      onPersonaChange(personaId, customSystemPrompt);
      toast.success(`Bytte till ${displayName}`);
    } catch (error) {
      console.error("Error updating persona:", error);
      toast.error("Kunde inte byta persona");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCustomPersona = async (personaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from("custom_personas")
        .delete()
        .eq("id", personaId);

      if (error) throw error;
      
      setCustomPersonas(prev => prev.filter(p => p.id !== personaId));
      toast.success("Persona borttagen");
      
      // If currently using this persona, switch to general
      if (currentPersona === `custom:${personaId}`) {
        handlePersonaChange("general");
      }
    } catch (error) {
      console.error("Error deleting persona:", error);
      toast.error("Kunde inte ta bort persona");
    }
  };

  const handleOpenCreateDialog = () => {
    setDropdownOpen(false);
    // Small delay to let dropdown close first
    setTimeout(() => setCreateDialogOpen(true), 100);
  };

  const handlePersonaCreated = () => {
    fetchCustomPersonas();
    setCreateDialogOpen(false);
  };

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto py-1 px-2 text-muted-foreground hover:text-foreground gap-1"
            disabled={updating}
          >
            <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${currentPersonaData.gradient} flex items-center justify-center`}>
              <CurrentIcon className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs hidden sm:inline">{currentPersonaData.name}</span>
            {updating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {/* Built-in personas */}
          {AI_PERSONAS.map((persona) => {
            const Icon = persona.icon;
            const isActive = persona.id === currentPersona || (!currentPersona && persona.id === "general");
            return (
              <DropdownMenuItem
                key={persona.id}
                onClick={() => handlePersonaChange(persona.id)}
                className="flex items-center gap-3 py-2.5 cursor-pointer"
              >
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${persona.gradient} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{persona.name}</div>
                  <p className="text-xs text-muted-foreground truncate">
                    {persona.description}
                  </p>
                </div>
                {isActive && <Check className="w-4 h-4 text-primary" />}
              </DropdownMenuItem>
            );
          })}

          {/* Custom personas section */}
          {customPersonas.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Egna personas
              </div>
              {customPersonas.map((persona) => {
                const Icon = getIconComponent(persona.icon);
                const isActive = currentPersona === `custom:${persona.id}`;
                return (
                  <DropdownMenuItem
                    key={persona.id}
                    onClick={() => handlePersonaChange(`custom:${persona.id}`, persona.system_prompt)}
                    className="flex items-center gap-3 py-2.5 cursor-pointer group"
                  >
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${persona.gradient} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{persona.name}</div>
                      <p className="text-xs text-muted-foreground truncate">
                        {persona.description || "Egen AI-persona"}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteCustomPersona(persona.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                    {isActive && <Check className="w-4 h-4 text-primary" />}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}

          {/* Create custom persona button */}
          <DropdownMenuSeparator />
          <div className="p-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full gap-2"
              onClick={handleOpenCreateDialog}
            >
              <Plus className="w-4 h-4" />
              Skapa egen persona
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog rendered outside dropdown to avoid portal conflicts */}
      <CustomPersonaDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onPersonaCreated={handlePersonaCreated} 
      />
    </>
  );
}
