import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Shield, Users, Settings, Plus } from "lucide-react";
import { toast } from "sonner";
import { LLMSettingsCard } from "@/components/LLMSettingsCard";
import { AIToolsSettingsCard } from "@/components/AIToolsSettingsCard";
import { PluginRegistryCard } from "@/components/PluginRegistryCard";

interface InviteCode {
  id: string;
  code: string;
  created_at: string;
  expires_at: string | null;
  used_by: string | null;
  used_at: string | null;
}

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  created_at: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requireInviteCode, setRequireInviteCode] = useState(true);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newCodePrefix, setNewCodePrefix] = useState("VALHALLA");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      checkAdminStatus();
    }
  }, [user, authLoading, navigate]);

  const checkAdminStatus = async () => {
    if (!user) return;

    const { data, error } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (error || !data) {
      toast.error("You do not have permission to access this page");
      navigate("/chats");
      return;
    }

    setIsAdmin(true);
    await Promise.all([fetchSettings(), fetchInviteCodes(), fetchUsers()]);
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("*")
      .eq("key", "require_invite_code")
      .single();

    if (data) {
      setRequireInviteCode(data.value === true);
    }
  };

  const fetchInviteCodes = async () => {
    const { data } = await supabase
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setInviteCodes(data);
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setUsers(data);
    }
  };

  const toggleInviteRequirement = async (checked: boolean) => {
    setRequireInviteCode(checked);

    const { error } = await supabase
      .from("app_settings")
      .update({ 
        value: checked, 
        updated_at: new Date().toISOString(),
        updated_by: user?.id 
      })
      .eq("key", "require_invite_code");

    if (error) {
      toast.error("Could not update setting");
      setRequireInviteCode(!checked);
    } else {
      toast.success(checked ? "Invite code now required" : "Invite code disabled");
    }
  };

  const generateInviteCode = async () => {
    const code = `${newCodePrefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    const { error } = await supabase
      .from("invite_codes")
      .insert({
        code,
        created_by: user?.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      });

    if (error) {
      toast.error("Could not create invite code");
    } else {
      toast.success(`New code created: ${code}`);
      fetchInviteCodes();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/chats")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="font-display text-xl font-bold">Admin Panel</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* LLM Settings Card */}
        <LLMSettingsCard />

        {/* AI Tools Settings Card */}
        <AIToolsSettingsCard />

        {/* Plugin Registry Card */}
        <PluginRegistryCard />

        {/* Settings Card */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Settings
            </CardTitle>
            <CardDescription>Manage application global settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="invite-toggle" className="text-base font-medium">
                  Require Invite Code
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, new users must enter a valid invite code to register
                </p>
              </div>
              <Switch
                id="invite-toggle"
                checked={requireInviteCode}
                onCheckedChange={toggleInviteRequirement}
              />
            </div>
          </CardContent>
        </Card>

        {/* Invite Codes Card */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Invite Codes
                </CardTitle>
                <CardDescription>Manage invite codes for new users</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newCodePrefix}
                  onChange={(e) => setNewCodePrefix(e.target.value.toUpperCase())}
                  placeholder="Prefix"
                  className="w-32 font-mono"
                />
                <Button onClick={generateInviteCode} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  New Code
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviteCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono">{code.code}</TableCell>
                    <TableCell>
                      {new Date(code.created_at).toLocaleDateString("en-US")}
                    </TableCell>
                    <TableCell>
                      {code.expires_at 
                        ? new Date(code.expires_at).toLocaleDateString("en-US")
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      {code.used_by ? (
                        <span className="text-muted-foreground">Used</span>
                      ) : code.expires_at && new Date(code.expires_at) < new Date() ? (
                        <span className="text-destructive">Expired</span>
                      ) : (
                        <span className="text-green-500">Active</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {inviteCodes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No invite codes created
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Users Card */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Users ({users.length})
            </CardTitle>
            <CardDescription>All registered users</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>{profile.display_name || "Unknown"}</TableCell>
                    <TableCell>
                      {new Date(profile.created_at).toLocaleDateString("en-US")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
