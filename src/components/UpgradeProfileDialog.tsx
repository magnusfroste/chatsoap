import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, Loader2, UserCheck, Mail, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const upgradeSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

interface UpgradeProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UpgradeProfileDialog({ open, onOpenChange }: UpgradeProfileDialogProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = upgradeSchema.safeParse({ displayName, email, password });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      // Update email and password for anonymous user
      const { error: updateError } = await supabase.auth.updateUser({
        email,
        password,
      });

      if (updateError) throw updateError;

      // Update profile display name
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      await refreshProfile();
      
      toast.success("Account saved! Check your email to confirm.");
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error upgrading profile:", err);
      if (err.message?.includes("already registered")) {
        toast.error("This email is already registered. Please log in instead.");
      } else {
        toast.error(err.message || "Failed to save account");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5 text-primary" />
            Save Your Account
          </DialogTitle>
          <DialogDescription>
            Add your email and password to keep access to your chats. You can log in again anytime!
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUpgrade} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="upgrade-name" className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Display Name
            </Label>
            <Input
              id="upgrade-name"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="upgrade-email" className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email
            </Label>
            <Input
              id="upgrade-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="upgrade-password" className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              Password
            </Label>
            <Input
              id="upgrade-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              At least 6 characters
            </p>
          </div>

          <Button 
            type="submit"
            disabled={loading}
            className="w-full gradient-valhalla hover:opacity-90"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4 mr-2" />
                Save Account
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
