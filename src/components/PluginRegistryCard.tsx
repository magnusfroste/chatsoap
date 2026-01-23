import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Puzzle, 
  Wrench, 
  Bot, 
  ChevronDown, 
  ChevronUp,
  Search,
  ScanEye,
  Code2,
  Play,
  ImagePlus,
  Presentation,
  Globe,
  Sparkles,
  PenLine,
  Palette,
  GraduationCap,
  Loader2,
  LucideIcon
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

interface ToolSettings {
  [key: string]: boolean;
}

interface PersonaSettings {
  [key: string]: boolean;
}

interface RegisteredTool {
  id: string;
  name: string;
  description: string;
  promptInstructions: string;
  icon: string;
  isBuiltIn: boolean;
}

interface RegisteredPersona {
  id: string;
  name: string;
  description: string;
  icon: string;
  gradient: string;
  isBuiltIn: boolean;
  preferredTools: string[];
}

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  ScanEye,
  Search,
  ImagePlus,
  Play,
  Code2,
  Presentation,
  Globe,
  Sparkles,
  PenLine,
  Palette,
  GraduationCap,
  Bot,
};

// Built-in tools from the registry
const registeredTools: RegisteredTool[] = [
  {
    id: "analyze_images",
    name: "Image Analysis",
    description: "Analyze attached images using vision capabilities",
    promptInstructions: "Use ONLY when the user explicitly asks to analyze, describe, or explain attached images.",
    icon: "ScanEye",
    isBuiltIn: true,
  },
  {
    id: "web_search",
    name: "Web Search",
    description: "Search the web for current information",
    promptInstructions: "Use when you need current/recent information that might be outdated in your training data.",
    icon: "Search",
    isBuiltIn: true,
  },
  {
    id: "generate_image",
    name: "Image Generation",
    description: "Generate an image based on a text description",
    promptInstructions: "Use when the user asks you to create, draw, generate, or visualize an image.",
    icon: "ImagePlus",
    isBuiltIn: true,
  },
  {
    id: "code_execution",
    name: "Code Execution",
    description: "Execute code and return the result",
    promptInstructions: "Use when the user asks you to run or execute code and show the result.",
    icon: "Play",
    isBuiltIn: true,
  },
  {
    id: "send_code_to_sandbox",
    name: "Code Sandbox",
    description: "Send code to the collaborative Code Sandbox canvas",
    promptInstructions: 'Use when the user asks you to "write a function", "create code", or wants to collaborate on code.',
    icon: "Code2",
    isBuiltIn: true,
  },
  {
    id: "generate_slides",
    name: "Slide Generation",
    description: "Generate a presentation/slideshow",
    promptInstructions: "Use when the user asks to create a presentation, slideshow, pitch deck, or slides.",
    icon: "Presentation",
    isBuiltIn: true,
  },
  {
    id: "navigate_browser",
    name: "Browser Navigation",
    description: "Navigate the Mini Browser canvas app to a URL",
    promptInstructions: 'Use when the user asks you to "go to", "open", "visit", or "navigate to" a website.',
    icon: "Globe",
    isBuiltIn: true,
  },
];

// Built-in personas from the registry
const registeredPersonas: RegisteredPersona[] = [
  {
    id: "general",
    name: "General Assistant",
    description: "A helpful, versatile AI for any task",
    icon: "Sparkles",
    gradient: "from-blue-500 to-cyan-500",
    isBuiltIn: true,
    preferredTools: [],
  },
  {
    id: "code",
    name: "Code Expert",
    description: "Specialized in programming and technical problem-solving",
    icon: "Code2",
    gradient: "from-green-500 to-emerald-500",
    isBuiltIn: true,
    preferredTools: ["send_code_to_sandbox", "code_execution"],
  },
  {
    id: "writer",
    name: "Writing Assistant",
    description: "Expert in creative and professional writing",
    icon: "PenLine",
    gradient: "from-purple-500 to-pink-500",
    isBuiltIn: true,
    preferredTools: [],
  },
  {
    id: "creative",
    name: "Creative Partner",
    description: "Innovative thinking and brainstorming companion",
    icon: "Palette",
    gradient: "from-orange-500 to-red-500",
    isBuiltIn: true,
    preferredTools: ["generate_image", "generate_slides"],
  },
  {
    id: "learning",
    name: "Learning Mentor",
    description: "Patient teacher adapting to your learning style",
    icon: "GraduationCap",
    gradient: "from-yellow-500 to-amber-500",
    isBuiltIn: true,
    preferredTools: ["web_search"],
  },
];

const defaultToolSettings: ToolSettings = {
  analyze_images: true,
  web_search: true,
  send_code_to_sandbox: true,
  code_execution: false,
  generate_image: false,
  generate_slides: true,
  navigate_browser: true,
};

const defaultPersonaSettings: PersonaSettings = {
  general: true,
  code: true,
  writer: true,
  creative: true,
  learning: true,
};

function ToolCard({ 
  tool, 
  enabled, 
  onToggle, 
  saving 
}: { 
  tool: RegisteredTool; 
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = iconMap[tool.icon] || Wrench;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-md shrink-0 ${enabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{tool.name}</span>
                {tool.isBuiltIn && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Built-in
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              disabled={saving}
              className="data-[state=checked]:bg-primary"
            />
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        
        <CollapsibleContent className="mt-3 pt-3 border-t border-border/50">
          <div className="space-y-2">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Tool ID</span>
              <code className="block text-xs bg-muted px-2 py-1 rounded mt-1 font-mono">
                {tool.id}
              </code>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Prompt Instructions</span>
              <p className="text-xs bg-muted px-2 py-1.5 rounded mt-1 text-foreground/80">
                {tool.promptInstructions}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function PersonaCard({ 
  persona, 
  enabled,
  onToggle,
  saving
}: { 
  persona: RegisteredPersona; 
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = iconMap[persona.icon] || Bot;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-md shrink-0 bg-gradient-to-br ${persona.gradient} ${enabled ? "opacity-100" : "opacity-40"} text-white`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{persona.name}</span>
                {persona.isBuiltIn && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Built-in
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{persona.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              disabled={saving}
              className="data-[state=checked]:bg-primary"
            />
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        
        <CollapsibleContent className="mt-3 pt-3 border-t border-border/50">
          <div className="space-y-2">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Persona ID</span>
              <code className="block text-xs bg-muted px-2 py-1 rounded mt-1 font-mono">
                {persona.id}
              </code>
            </div>
            {persona.preferredTools.length > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Preferred Tools</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {persona.preferredTools.map((toolId) => (
                    <Badge key={toolId} variant="outline" className="text-[10px]">
                      {toolId}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function PluginRegistryCard() {
  const [toolSettings, setToolSettings] = useState<ToolSettings>(defaultToolSettings);
  const [personaSettings, setPersonaSettings] = useState<PersonaSettings>(defaultPersonaSettings);
  const [loading, setLoading] = useState(true);
  const [savingTool, setSavingTool] = useState<string | null>(null);
  const [savingPersona, setSavingPersona] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();

    // Subscribe to realtime changes for plugin settings
    const channel = supabase
      .channel('plugin-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'key' in payload.new && 'value' in payload.new) {
            const { key, value } = payload.new as { key: string; value: unknown };
            
            if (key === 'ai_tools_enabled' && value && typeof value === 'object') {
              setToolSettings({ ...defaultToolSettings, ...(value as ToolSettings) });
            } else if (key === 'ai_personas_enabled' && value && typeof value === 'object') {
              setPersonaSettings({ ...defaultPersonaSettings, ...(value as PersonaSettings) });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const [toolsResult, personasResult] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "ai_tools_enabled").single(),
        supabase.from("app_settings").select("value").eq("key", "ai_personas_enabled").single(),
      ]);

      if (toolsResult.data?.value && typeof toolsResult.data.value === "object") {
        setToolSettings({ ...defaultToolSettings, ...(toolsResult.data.value as ToolSettings) });
      }
      
      if (personasResult.data?.value && typeof personasResult.data.value === "object") {
        setPersonaSettings({ ...defaultPersonaSettings, ...(personasResult.data.value as PersonaSettings) });
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = async (toolId: string, enabled: boolean) => {
    const newSettings = { ...toolSettings, [toolId]: enabled };
    setToolSettings(newSettings);
    setSavingTool(toolId);

    try {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "ai_tools_enabled")
        .single();

      if (existing) {
        await supabase
          .from("app_settings")
          .update({ value: newSettings, updated_at: new Date().toISOString() })
          .eq("key", "ai_tools_enabled");
      } else {
        await supabase
          .from("app_settings")
          .insert({ key: "ai_tools_enabled", value: newSettings });
      }

      const tool = registeredTools.find(t => t.id === toolId);
      toast.success(`${tool?.name || toolId} ${enabled ? "enabled" : "disabled"}`);
    } catch {
      setToolSettings(toolSettings);
      toast.error("Failed to save setting");
    } finally {
      setSavingTool(null);
    }
  };

  const togglePersona = async (personaId: string, enabled: boolean) => {
    const newSettings = { ...personaSettings, [personaId]: enabled };
    setPersonaSettings(newSettings);
    setSavingPersona(personaId);

    try {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "ai_personas_enabled")
        .single();

      if (existing) {
        await supabase
          .from("app_settings")
          .update({ value: newSettings, updated_at: new Date().toISOString() })
          .eq("key", "ai_personas_enabled");
      } else {
        await supabase
          .from("app_settings")
          .insert({ key: "ai_personas_enabled", value: newSettings });
      }

      const persona = registeredPersonas.find(p => p.id === personaId);
      toast.success(`${persona?.name || personaId} ${enabled ? "enabled" : "disabled"}`);
    } catch {
      setPersonaSettings(personaSettings);
      toast.error("Failed to save setting");
    } finally {
      setSavingPersona(null);
    }
  };

  const enabledToolsCount = Object.values(toolSettings).filter(Boolean).length;
  const enabledPersonasCount = Object.values(personaSettings).filter(Boolean).length;

  if (loading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Puzzle className="w-5 h-5" />
          Plugin Registry
        </CardTitle>
        <CardDescription>
          Enable or disable tools and personas. Third-party plugins will appear here when registered.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tools" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Tools ({enabledToolsCount}/{registeredTools.length})
            </TabsTrigger>
            <TabsTrigger value="personas" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Personas ({enabledPersonasCount}/{registeredPersonas.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="tools" className="space-y-2 mt-0">
            {registeredTools.map((tool) => (
              <ToolCard 
                key={tool.id} 
                tool={tool} 
                enabled={toolSettings[tool.id] ?? false}
                onToggle={(enabled) => toggleTool(tool.id, enabled)}
                saving={savingTool === tool.id}
              />
            ))}
            
            <div className="pt-3 border-t border-border/50 mt-4">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Disabled tools won't be available to the AI. Some tools require API keys (e.g., Web Search needs Firecrawl).
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="personas" className="space-y-2 mt-0">
            {registeredPersonas.map((persona) => (
              <PersonaCard 
                key={persona.id} 
                persona={persona}
                enabled={personaSettings[persona.id] ?? true}
                onToggle={(enabled) => togglePersona(persona.id, enabled)}
                saving={savingPersona === persona.id}
              />
            ))}
            
            <div className="pt-3 border-t border-border/50 mt-4">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Disabled personas won't appear in the persona switcher. Users can still create custom personas.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
