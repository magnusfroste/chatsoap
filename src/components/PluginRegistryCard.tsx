import { useState } from "react";
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
  LucideIcon
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Simulated registry data - in production this would come from the modular prompt system
interface RegisteredTool {
  id: string;
  name: string;
  description: string;
  promptInstructions: string;
  icon: string;
  isBuiltIn: boolean;
  isAvailable: boolean;
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
    isAvailable: true,
  },
  {
    id: "web_search",
    name: "Web Search",
    description: "Search the web for current information",
    promptInstructions: "Use when you need current/recent information that might be outdated in your training data.",
    icon: "Search",
    isBuiltIn: true,
    isAvailable: true, // Would check FIRECRAWL_API_KEY in production
  },
  {
    id: "generate_image",
    name: "Image Generation",
    description: "Generate an image based on a text description",
    promptInstructions: "Use when the user asks you to create, draw, generate, or visualize an image.",
    icon: "ImagePlus",
    isBuiltIn: true,
    isAvailable: true,
  },
  {
    id: "code_execution",
    name: "Code Execution",
    description: "Execute code and return the result",
    promptInstructions: "Use when the user asks you to run or execute code and show the result.",
    icon: "Play",
    isBuiltIn: true,
    isAvailable: true,
  },
  {
    id: "send_code_to_sandbox",
    name: "Code Sandbox",
    description: "Send code to the collaborative Code Sandbox canvas",
    promptInstructions: 'Use when the user asks you to "write a function", "create code", or wants to collaborate on code.',
    icon: "Code2",
    isBuiltIn: true,
    isAvailable: true,
  },
  {
    id: "generate_slides",
    name: "Slide Generation",
    description: "Generate a presentation/slideshow",
    promptInstructions: "Use when the user asks to create a presentation, slideshow, pitch deck, or slides.",
    icon: "Presentation",
    isBuiltIn: true,
    isAvailable: true,
  },
  {
    id: "navigate_browser",
    name: "Browser Navigation",
    description: "Navigate the Mini Browser canvas app to a URL",
    promptInstructions: 'Use when the user asks you to "go to", "open", "visit", or "navigate to" a website.',
    icon: "Globe",
    isBuiltIn: true,
    isAvailable: true,
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

function ToolCard({ tool }: { tool: RegisteredTool }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = iconMap[tool.icon] || Wrench;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md ${tool.isAvailable ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{tool.name}</span>
                {tool.isBuiltIn && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Built-in
                  </Badge>
                )}
                {!tool.isAvailable && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-500 border-amber-500/50">
                    Unavailable
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{tool.description}</p>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
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

function PersonaCard({ persona }: { persona: RegisteredPersona }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = iconMap[persona.icon] || Bot;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md bg-gradient-to-br ${persona.gradient} text-white`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{persona.name}</span>
                {persona.isBuiltIn && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Built-in
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{persona.description}</p>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
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
  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Puzzle className="w-5 h-5" />
          Plugin Registry
        </CardTitle>
        <CardDescription>
          View registered tools and personas from the modular prompt system. Third-party plugins will appear here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tools" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Tools ({registeredTools.length})
            </TabsTrigger>
            <TabsTrigger value="personas" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Personas ({registeredPersonas.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="tools" className="space-y-2 mt-0">
            {registeredTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
            
            <div className="pt-3 border-t border-border/50 mt-4">
              <p className="text-xs text-muted-foreground">
                <strong>Developer note:</strong> Register custom tools via <code className="text-[10px] bg-muted px-1 rounded">registerTool()</code> in edge functions. 
                See <code className="text-[10px] bg-muted px-1 rounded">docs/examples/</code> for examples.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="personas" className="space-y-2 mt-0">
            {registeredPersonas.map((persona) => (
              <PersonaCard key={persona.id} persona={persona} />
            ))}
            
            <div className="pt-3 border-t border-border/50 mt-4">
              <p className="text-xs text-muted-foreground">
                <strong>Developer note:</strong> Register custom personas via <code className="text-[10px] bg-muted px-1 rounded">registerPersona()</code> in edge functions. 
                Users can also create custom personas in chat settings.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
