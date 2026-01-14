import { Bell, Volume2, Vibrate } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";

export const NotificationSettingsCard = () => {
  const {
    settings,
    toggleSound,
    toggleVibration,
    setVolume,
    triggerNotificationEffect,
  } = useNotificationSettings();

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const handleTestNotification = () => {
    triggerNotificationEffect();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5 text-muted-foreground" />
          Notifikationsinställningar
        </CardTitle>
        <CardDescription>
          Konfigurera ljud och vibration för nya meddelanden
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sound Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label htmlFor="sound-toggle" className="font-medium">
                Notifikationsljud
              </Label>
              <p className="text-sm text-muted-foreground">
                Spela upp ljud vid nya meddelanden
              </p>
            </div>
          </div>
          <Switch
            id="sound-toggle"
            checked={settings.soundEnabled}
            onCheckedChange={toggleSound}
          />
        </div>

        {/* Volume Slider */}
        {settings.soundEnabled && (
          <div className="space-y-3 pl-8">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Ljudvolym</Label>
              <span className="text-sm text-muted-foreground">
                {Math.round(settings.soundVolume * 100)}%
              </span>
            </div>
            <Slider
              value={[settings.soundVolume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.1}
              className="w-full"
            />
          </div>
        )}

        {/* Vibration Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Vibrate className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label htmlFor="vibration-toggle" className="font-medium">
                Vibration
              </Label>
              <p className="text-sm text-muted-foreground">
                Vibrera vid nya meddelanden (mobil)
              </p>
            </div>
          </div>
          <Switch
            id="vibration-toggle"
            checked={settings.vibrationEnabled}
            onCheckedChange={toggleVibration}
          />
        </div>

        {/* Test Button */}
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={handleTestNotification}
            className="w-full"
          >
            Testa notifikationseffekt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
