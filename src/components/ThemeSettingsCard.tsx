import { Sun, Moon, Monitor } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export const ThemeSettingsCard = () => {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sun className="w-5 h-5 text-muted-foreground" />
          Appearance
        </CardTitle>
        <CardDescription>
          Choose your preferred theme
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {options.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.value;

            return (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                )}
              >
                <Icon className={cn(
                  "w-6 h-6",
                  isActive ? "text-primary" : "text-muted-foreground"
                )} />
                <Label className={cn(
                  "text-sm font-medium cursor-pointer",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {option.label}
                </Label>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
