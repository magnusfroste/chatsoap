import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Zap, Plus, LogOut, Users, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Room {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchRooms();
    }
  }, [user]);

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching rooms:", error);
    } else {
      setRooms(data || []);
    }
    setLoadingRooms(false);
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !user) return;

    setCreating(true);
    
    // Create room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        name: newRoomName,
        description: newRoomDesc || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (roomError) {
      toast.error("Kunde inte skapa rum");
      setCreating(false);
      return;
    }

    // Add creator as member
    await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: user.id,
    });

    toast.success("Rum skapat!");
    setNewRoomName("");
    setNewRoomDesc("");
    setDialogOpen(false);
    setCreating(false);
    fetchRooms();
  };

  const generateInviteCode = async () => {
    if (!user) return;
    
    const code = `VALHALLA-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    const { error } = await supabase.from("invite_codes").insert({
      code,
      created_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    });

    if (error) {
      toast.error("Kunde inte skapa inbjudningskod");
    } else {
      setInviteCode(code);
    }
  };

  const copyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast.success("Kopierat!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading || loadingRooms) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-valhalla-deep via-background to-background -z-10" />
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-valhalla-purple/10 blur-[120px] rounded-full -z-10" />

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg gradient-valhalla flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold">Silicon Valhalla</span>
          </div>
          <div className="flex items-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={generateInviteCode}>
                  Bjud in
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bjud in till Valhalla</DialogTitle>
                  <DialogDescription>
                    Dela denna kod med någon du vill bjuda in
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                  {inviteCode ? (
                    <div className="flex items-center gap-2">
                      <Input 
                        value={inviteCode} 
                        readOnly 
                        className="font-mono text-lg text-center"
                      />
                      <Button onClick={copyInviteCode} size="icon" variant="outline">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={generateInviteCode} className="w-full">
                      Generera kod
                    </Button>
                  )}
                  <p className="text-sm text-muted-foreground mt-3">
                    Koden är giltig i 7 dagar.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Dina rum</h1>
            <p className="text-muted-foreground mt-1">
              Skapa eller gå med i ett rum för att börja samarbeta
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-valhalla hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                Nytt rum
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Skapa nytt rum</DialogTitle>
                <DialogDescription>
                  Ge rummet ett namn och beskrivning
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createRoom} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="room-name">Namn *</Label>
                  <Input
                    id="room-name"
                    placeholder="T.ex. AI Strategy Q1"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="room-desc">Beskrivning</Label>
                  <Input
                    id="room-desc"
                    placeholder="Valfri beskrivning..."
                    value={newRoomDesc}
                    onChange={(e) => setNewRoomDesc(e.target.value)}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full gradient-valhalla hover:opacity-90"
                  disabled={creating}
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Skapa rum
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Rooms grid */}
        {rooms.length === 0 ? (
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">Inga rum ännu</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Skapa ditt första rum för att börja samarbeta med AI och ditt team.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <Card 
                key={room.id} 
                className="glass-card hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => navigate(`/room/${room.id}`)}
              >
                <CardHeader>
                  <CardTitle className="font-display group-hover:text-primary transition-colors">
                    {room.name}
                  </CardTitle>
                  {room.description && (
                    <CardDescription>{room.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Skapad {new Date(room.created_at).toLocaleDateString("sv-SE")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
