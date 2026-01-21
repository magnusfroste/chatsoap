import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Wrench, Search, ScanEye, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ToolSettings {
  analyze_images: boolean;
  web_search: boolean;
}

const defaultSettings: ToolSettings = {
  analyze_images: true,
  web_search: true,
};

const toolInfo = {
  analyze_images: {
    name: "Image Analysis",
    description: "Let AI analyze and describe images attached by users",
    icon: ScanEye,
  },
  web_search: {
    name: "Web Search",
    description: "Search the web via Firecrawl when AI knowledge is insufficient",
    icon: Search,
  },
};

export function AIToolsSettingsCard() {
  const [settings, setSettings] = useState<ToolSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ai_tools_enabled")
        .single();

      if (data?.value && typeof data.value === "object") {
        setSettings({ ...defaultSettings, ...(data.value as Partial<ToolSettings>) });
      }
    } catch {
      // Use defaults if no setting exists
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = async (tool: keyof ToolSettings, enabled: boolean) => {
    const newSettings = { ...settings, [tool]: enabled };
    setSettings(newSettings);
    setSaving(tool);

    try {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "ai_tools_enabled")
        .single();

      if (existing) {
        await supabase
          .from("app_settings")
          .update({
            value: newSettings,
            updated_at: new Date().toISOString(),
          })
          .eq("key", "ai_tools_enabled");
      } else {
        await supabase
          .from("app_settings")
          .insert({
            key: "ai_tools_enabled",
            value: newSettings,
          });
      }

      toast.success(`${toolInfo[tool].name} ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      setSettings(settings); // Revert
      toast.error("Failed to save setting");
    } finally {
      setSaving(null);
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
          <Wrench className="w-5 h-5" />
          AI Tools
        </CardTitle>
        <CardDescription>
          Enable or disable AI capabilities. Tools let the AI perform actions beyond text generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(toolInfo) as Array<keyof ToolSettings>).map((tool) => {
          const info = toolInfo[tool];
          const Icon = info.icon;
          const isEnabled = settings[tool];
          const isSaving = saving === tool;

          return (
            <div
              key={tool}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${isEnabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <Label htmlFor={`tool-${tool}`} className="text-sm font-medium cursor-pointer">
                    {info.name}
                  </Label>
                  <p className="text-xs text-muted-foreground">{info.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                <Switch
                  id={`tool-${tool}`}
                  checked={isEnabled}
                  onCheckedChange={(checked) => toggleTool(tool, checked)}
                  disabled={isSaving}
                />
              </div>
            </div>
          );
        })}

        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Web Search requires Firecrawl connector. Code and browser actions are handled automatically via chat artifacts.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
