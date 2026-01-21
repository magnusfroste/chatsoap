import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, Loader2, Check, AlertCircle, Zap, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type LLMProvider = "lovable" | "openai" | "gemini" | "custom";

interface CustomConfig {
  url: string;
  model: string;
}

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o (Recommended)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Faster)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Budget)" },
];

const GEMINI_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Recommended)" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Advanced)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
];

const NOTES_AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notes-ai`;

export function LLMSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [provider, setProvider] = useState<LLMProvider>("lovable");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [customConfig, setCustomConfig] = useState<CustomConfig>({ url: "", model: "" });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["llm_provider", "llm_openai_model", "llm_gemini_model", "llm_custom_config"]);

      if (data) {
        data.forEach((setting) => {
          const val = setting.value;
          switch (setting.key) {
            case "llm_provider":
              if (typeof val === "string") setProvider(val as LLMProvider);
              break;
            case "llm_openai_model":
              if (typeof val === "string") setOpenaiModel(val);
              break;
            case "llm_gemini_model":
              if (typeof val === "string") setGeminiModel(val);
              break;
            case "llm_custom_config":
              if (val && typeof val === "object" && !Array.isArray(val)) {
                const config = val as Record<string, unknown>;
                setCustomConfig({
                  url: typeof config.url === "string" ? config.url : "",
                  model: typeof config.model === "string" ? config.model : "",
                });
              }
              break;
          }
        });
      }
    } catch (error) {
      console.error("Error fetching LLM settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: "llm_provider", value: JSON.stringify(provider) },
        { key: "llm_openai_model", value: JSON.stringify(openaiModel) },
        { key: "llm_gemini_model", value: JSON.stringify(geminiModel) },
        { key: "llm_custom_config", value: JSON.stringify(customConfig) },
      ];

      for (const { key, value } of updates) {
        await supabase
          .from("app_settings")
          .update({ value: JSON.parse(value), updated_at: new Date().toISOString() })
          .eq("key", key);
      }

      toast.success("LLM settings saved");
    } catch (error) {
      console.error("Error saving LLM settings:", error);
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(NOTES_AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: "summarize",
          content: "Hello, this is a test message to verify the AI connection is working correctly.",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      // Read and consume the stream to verify it works
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      let receivedContent = false;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        if (text.includes('"content"')) {
          receivedContent = true;
        }
      }

      if (receivedContent) {
        setTestResult("success");
        toast.success("Connection successful! AI provider is working.");
      } else {
        throw new Error("No content received from AI");
      }
    } catch (error) {
      console.error("Test connection error:", error);
      setTestResult("error");
      toast.error((error as Error).message || "Connection failed");
    } finally {
      setTesting(false);
    }
  };

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
          <Bot className="w-5 h-5" />
          AI Provider Settings
        </CardTitle>
        <CardDescription>
          Configure which AI provider to use for chat and document analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={provider}
          onValueChange={(v) => setProvider(v as LLMProvider)}
          className="space-y-3"
        >
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="lovable" id="lovable" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="lovable" className="font-medium cursor-pointer">
                Lovable AI
              </Label>
              <p className="text-sm text-muted-foreground">
                Default provider, no API key needed. Uses Gemini 2.5 Flash.
              </p>
            </div>
            {provider === "lovable" && <Check className="w-5 h-5 text-green-500" />}
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="openai" id="openai" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="openai" className="font-medium cursor-pointer">
                OpenAI
              </Label>
              <p className="text-sm text-muted-foreground">
                GPT-4o and other OpenAI models
              </p>
            </div>
            {provider === "openai" && <Check className="w-5 h-5 text-green-500" />}
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="gemini" id="gemini" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="gemini" className="font-medium cursor-pointer">
                Google Gemini
              </Label>
              <p className="text-sm text-muted-foreground">
                Gemini 2.5 Pro/Flash models via Google AI
              </p>
            </div>
            {provider === "gemini" && <Check className="w-5 h-5 text-green-500" />}
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="custom" id="custom" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="custom" className="font-medium cursor-pointer">
                Custom (OpenAI-compatible)
              </Label>
              <p className="text-sm text-muted-foreground">
                Private LLM with OpenAI-compatible API endpoint
              </p>
            </div>
            {provider === "custom" && <Check className="w-5 h-5 text-green-500" />}
          </div>
        </RadioGroup>

        {/* Provider-specific settings */}
        {provider === "openai" && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={openaiModel} onValueChange={setOpenaiModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPENAI_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Set <code className="px-1 py-0.5 bg-muted rounded text-xs">OPENAI_API_KEY</code> in 
                backend secrets for this to work.
              </p>
            </div>
          </div>
        )}

        {provider === "gemini" && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={geminiModel} onValueChange={setGeminiModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEMINI_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Set <code className="px-1 py-0.5 bg-muted rounded text-xs">GEMINI_API_KEY</code> in 
                backend secrets for this to work.
              </p>
            </div>
          </div>
        )}

        {provider === "custom" && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
            <div className="space-y-2">
              <Label htmlFor="custom-url">Endpoint URL</Label>
              <Input
                id="custom-url"
                type="url"
                placeholder="https://your-llm-endpoint.com/v1/chat/completions"
                value={customConfig.url}
                onChange={(e) => setCustomConfig((c) => ({ ...c, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-model">Model Name</Label>
              <Input
                id="custom-model"
                placeholder="e.g. my-custom-model"
                value={customConfig.model}
                onChange={(e) => setCustomConfig((c) => ({ ...c, model: e.target.value }))}
              />
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Set <code className="px-1 py-0.5 bg-muted rounded text-xs">CUSTOM_LLM_API_KEY</code> in 
                backend secrets for this to work.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={testing || saving}
            className="gap-2"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : testResult === "success" ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Connected
              </>
            ) : testResult === "error" ? (
              <>
                <XCircle className="w-4 h-4 text-destructive" />
                Failed
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Test Connection
              </>
            )}
          </Button>
          <Button onClick={saveSettings} disabled={saving || testing}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
