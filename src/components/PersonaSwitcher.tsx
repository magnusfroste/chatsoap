import { useState } from "react";
import { Bot, Code, Pen, Lightbulb, GraduationCap, ChevronDown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface PersonaSwitcherProps {
  conversationId: string;
  currentPersona: string | null | undefined;
  onPersonaChange: (persona: string) => void;
}

export function PersonaSwitcher({ conversationId, currentPersona, onPersonaChange }: PersonaSwitcherProps) {
  const [updating, setUpdating] = useState(false);
  
  const currentPersonaData = AI_PERSONAS.find(p => p.id === currentPersona) || AI_PERSONAS[0];
  const CurrentIcon = currentPersonaData.icon;

  const handlePersonaChange = async (personaId: string) => {
    if (personaId === currentPersona || updating) return;
    
    setUpdating(true);
    try {
      const persona = AI_PERSONAS.find(p => p.id === personaId);
      
      const { error } = await supabase
        .from("conversations")
        .update({ 
          persona: personaId,
          name: persona?.name || "AI Assistent"
        })
        .eq("id", conversationId);

      if (error) throw error;
      
      onPersonaChange(personaId);
      toast.success(`Bytte till ${persona?.name}`);
    } catch (error) {
      console.error("Error updating persona:", error);
      toast.error("Kunde inte byta persona");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <DropdownMenu>
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
      <DropdownMenuContent align="start" className="w-64">
        {AI_PERSONAS.map((persona) => {
          const Icon = persona.icon;
          const isActive = persona.id === (currentPersona || "general");
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
