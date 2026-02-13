import { useState, useEffect, useCallback } from "react";
import { Play, Loader2, Code2, Copy, Check, Trash2, Terminal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCodeSandbox } from "@/hooks/useCodeSandbox";
import { supabase } from "@/integrations/supabase/client";
import { CanvasAppProps } from "@/lib/canvas-apps/types";
import { canvasEventBus } from "@/lib/canvas-apps/events";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Simple code editor with syntax highlighting hints
function CodeEditor({
  code,
  onChange,
  language,
  disabled,
}: {
  code: string;
  onChange: (code: string) => void;
  language: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative h-full">
      <textarea
        value={code}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full h-full p-4 font-mono text-sm bg-background/50 border-0 resize-none",
          "focus:outline-none focus:ring-0",
          "placeholder:text-muted-foreground/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        placeholder={`// Write your ${language} code here...`}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
    </div>
  );
}

// Output console component
function OutputConsole({ output, isError }: { output: string; isError?: boolean }) {
  return (
    <ScrollArea className="h-full">
      <pre
        className={cn(
          "p-4 font-mono text-sm whitespace-pre-wrap",
          isError ? "text-destructive" : "text-foreground"
        )}
      >
        {output || <span className="text-muted-foreground italic">Run code to see output...</span>}
      </pre>
    </ScrollArea>
  );
}

interface CodeSandboxAppProps extends CanvasAppProps {
  conversationId: string;
  userId?: string;
}

const CodeSandboxApp = ({ conversationId, userId }: CodeSandboxAppProps) => {
  const [activeTab, setActiveTab] = useState<"code" | "output">("code");
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure room exists for this conversation
  useEffect(() => {
    if (!conversationId || !userId) return;

    const setupRoom = async () => {
      try {
        // Check if room exists
        const { data: existingRoom } = await supabase
          .from("rooms")
          .select("id")
          .eq("id", conversationId)
          .maybeSingle();

        if (!existingRoom) {
          // Create room
          const { error: roomError } = await supabase.from("rooms").insert({
            id: conversationId,
            name: `Code Sandbox - ${conversationId.slice(0, 8)}`,
            created_by: userId,
          });

          if (roomError && !roomError.message.includes("duplicate")) {
            throw roomError;
          }
        }

        // Check if member exists
        const { data: existingMember } = await supabase
          .from("room_members")
          .select("id")
          .eq("room_id", conversationId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingMember) {
          // Add as member
          const { error: memberError } = await supabase.from("room_members").insert({
            room_id: conversationId,
            user_id: userId,
          });

          if (memberError && !memberError.message.includes("duplicate")) {
            throw memberError;
          }
        }

        setIsReady(true);
      } catch (err) {
        console.error("Error setting up room:", err);
        setError("Could not initialize sandbox");
      }
    };

    setupRoom();
  }, [conversationId, userId]);

  const {
    code,
    language,
    lastOutput,
    isLoading,
    isExecuting,
    isSaving,
    updateCode,
    updateLanguage,
    executeCode,
  } = useCodeSandbox({
    roomId: conversationId,
    userId: userId || "",
  });

  // Listen for code:send events from AI
  useEffect(() => {
    const unsubscribe = canvasEventBus.on("code:send", async (payload) => {
      updateCode(payload.code);
      if (payload.language) {
        updateLanguage(payload.language);
      }
      setActiveTab("code");
      toast.success("Code received from AI");
      
      // Auto-run if requested
      if (payload.autoRun) {
        setTimeout(async () => {
          await executeCode();
          setActiveTab("output");
        }, 100);
      }
    });

    return unsubscribe;
  }, [updateCode, updateLanguage, executeCode]);

  const handleRun = useCallback(async () => {
    await executeCode();
    setActiveTab("output");
  }, [executeCode]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleClear = useCallback(() => {
    updateCode("");
  }, [updateCode]);

  // Loading state
  if (!isReady || isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Loading sandbox...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Code2 className="w-8 h-8 text-destructive" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!userId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Code2 className="w-8 h-8" />
          <span className="text-sm">Sign in to use Code Sandbox</span>
        </div>
      </div>
    );
  }

  const isErrorOutput = lastOutput.startsWith("❌");

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Tabs
            value={language}
            onValueChange={(v) => updateLanguage(v as "javascript" | "typescript")}
          >
            <TabsList className="h-8">
              <TabsTrigger value="javascript" className="text-xs px-3">
                JavaScript
              </TabsTrigger>
              <TabsTrigger value="typescript" className="text-xs px-3">
                TypeScript
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {isSaving && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>Synkar...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 px-2"
            title="Kopiera kod"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-8 px-2"
            title="Rensa kod"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleRun}
            disabled={isExecuting || !code.trim()}
            className="h-8 gap-1.5"
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Kör
          </Button>
        </div>
      </div>

      {/* Code/Output tabs for mobile */}
      <div className="flex-1 flex flex-col min-h-0 md:flex-row">
        {/* Mobile tabs */}
        <div className="md:hidden border-b">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "code" | "output")}>
            <TabsList className="w-full justify-start rounded-none bg-transparent border-0 p-0">
              <TabsTrigger
                value="code"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                <Code2 className="w-4 h-4 mr-1" />
                Kod
              </TabsTrigger>
              <TabsTrigger
                value="output"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                <Terminal className="w-4 h-4 mr-1" />
                Output
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Desktop split view */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Code editor */}
          <div
            className={cn(
              "flex-1 min-h-0",
              activeTab !== "code" && "hidden md:block",
              "md:border-r"
            )}
          >
            <div className="h-full flex flex-col">
              <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/20 border-b flex items-center gap-1">
                <Code2 className="w-3 h-3" />
                Editor
              </div>
              <div className="flex-1 min-h-0">
                <CodeEditor
                  code={code}
                  onChange={updateCode}
                  language={language}
                  disabled={isExecuting}
                />
              </div>
            </div>
          </div>

          {/* Output console */}
          <div
            className={cn(
              "flex-1 min-h-0 bg-muted/10",
              activeTab !== "output" && "hidden md:block"
            )}
          >
            <div className="h-full flex flex-col">
              <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/20 border-b flex items-center gap-1">
                <Terminal className="w-3 h-3" />
                Console
              </div>
              <div className="flex-1 min-h-0">
                <OutputConsole output={lastOutput} isError={isErrorOutput} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeSandboxApp;
