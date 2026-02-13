import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MessageSquare, Zap, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Random name generator
const adjectives = ["Happy", "Swift", "Clever", "Brave", "Calm", "Wise", "Kind", "Bold"];
const animals = ["Penguin", "Fox", "Owl", "Bear", "Wolf", "Eagle", "Dolphin", "Tiger"];

function generateRandomName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${animal}${num}`;
}

interface InviteLink {
  id: string;
  token: string;
  created_by: string;
  conversation_id: string | null;
  conversation_name: string | null;
  used_by: string | null;
}

export default function JoinChat() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string>("Someone");

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase
        .from("chat_invite_links")
        .select("*")
        .eq("token", token)
        .is("used_by", null)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        setError("This invite link is invalid or has already been used.");
        setLoading(false);
        return;
      }

      setInviteLink(data);

      // Get creator's name
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", data.created_by)
        .single();

      if (profile?.display_name) {
        setCreatorName(profile.display_name);
      }
    } catch (err) {
      console.error("Error validating token:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteLink || joining) return;
    
    setJoining(true);
    try {
      let currentUserId = user?.id;

      // If not logged in, sign in anonymously
      if (!currentUserId) {
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
        
        if (anonError) throw anonError;
        currentUserId = anonData.user?.id;

        if (!currentUserId) throw new Error("Failed to create anonymous session");

        // Create a profile with random name
        const randomName = generateRandomName();
        await supabase.from("profiles").insert({
          user_id: currentUserId,
          display_name: randomName,
        });
      }

      const conversationId = inviteLink.conversation_id;
      if (!conversationId) {
        throw new Error("Invalid invite link - no conversation associated");
      }

      // Atomically claim the invite: only succeeds if used_by is still null
      const { data: claimed, error: claimError } = await supabase
        .from("chat_invite_links")
        .update({
          used_by: currentUserId,
          used_at: new Date().toISOString(),
        })
        .eq("id", inviteLink.id)
        .is("used_by", null)
        .select()
        .maybeSingle();

      if (claimError) throw claimError;

      if (!claimed) {
        setError("This invite link has already been used.");
        return;
      }

      // Add the joining user as a member
      const { error: memberError } = await supabase
        .from("conversation_members")
        .insert({
          conversation_id: conversationId,
          user_id: currentUserId,
        });

      // Ignore duplicate key error (already a member)
      if (memberError && !memberError.message.includes("duplicate")) {
        throw memberError;
      }

      toast.success("Welcome to the chat!");
      navigate(`/chat/${conversationId}`);
    } catch (err) {
      console.error("Error joining chat:", err);
      toast.error("Failed to join chat. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-valhalla-deep via-background to-background" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-valhalla-purple/15 blur-[100px] rounded-full" />
      
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-lg gradient-valhalla flex items-center justify-center glow-valhalla">
            <Zap className="w-7 h-7 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold">ChatSoap</span>
        </div>

        <Card className="glass-card border-border/50">
          {error ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <CardTitle>Invalid Invite</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate("/")}
                >
                  Go to Home
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>You're Invited!</CardTitle>
                <CardDescription>
                  <span className="font-medium text-foreground">{creatorName}</span> invited you to chat
                  {inviteLink?.conversation_name && (
                    <span className="block mt-1">
                      "{inviteLink.conversation_name}"
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full gradient-valhalla hover:opacity-90"
                >
                  {joining ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Join Chat
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  {user ? (
                    "You'll join with your current account."
                  ) : (
                    "You'll join as a guest. You can save your account later!"
                  )}
                </p>

                {!user && (
                  <div className="pt-2 border-t border-border">
                    <Button 
                      variant="ghost" 
                      className="w-full text-muted-foreground"
                      onClick={() => navigate("/auth")}
                    >
                      Already have an account? Log in
                    </Button>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
