import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Save, X } from "lucide-react";
import UpgradeProfileDialog from "@/components/UpgradeProfileDialog";

export default function AnonymousUserBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Check if user is anonymous (no email)
  const isAnonymous = user && !user.email;

  if (!isAnonymous || dismissed) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/20 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">
            <span className="font-medium">You're browsing as a guest.</span>{" "}
            <span className="text-muted-foreground">Save your account to keep access to your chats!</span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => setUpgradeOpen(true)}
              className="gradient-valhalla hover:opacity-90"
            >
              <Save className="w-4 h-4 mr-1" />
              Save Account
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setDismissed(true)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <UpgradeProfileDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
