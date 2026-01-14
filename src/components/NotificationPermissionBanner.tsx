import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";

export const NotificationPermissionBanner = () => {
  const { permission, isSupported, requestPermission } = useNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    const wasDismissed = sessionStorage.getItem("notification-banner-dismissed");
    if (wasDismissed) {
      setDismissed(true);
    }
    
    // Show banner after a short delay if permission not granted
    if (isSupported && permission === "default" && !wasDismissed) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission]);

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      setShow(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
    sessionStorage.setItem("notification-banner-dismissed", "true");
  };

  if (!show || dismissed || permission !== "default") {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10 text-primary">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground text-sm">Aktivera notifikationer</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Få notiser när du får nya meddelanden, även när appen inte är i fokus.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={handleEnable} className="text-xs">
                Aktivera
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs">
                Inte nu
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mt-1 -mr-1"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
