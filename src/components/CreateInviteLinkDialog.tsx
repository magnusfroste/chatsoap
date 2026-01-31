import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link, Copy, Check, Loader2, UserPlus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface CreateInviteLinkDialogProps {
  trigger?: React.ReactNode;
  conversationId?: string;
  conversationName?: string;
}

export default function CreateInviteLinkDialog({ 
  trigger, 
  conversationId,
  conversationName 
}: CreateInviteLinkDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [createdConversationId, setCreatedConversationId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let targetConversationId = conversationId;

      // If no existing conversation, create one now so the creator can start chatting
      if (!targetConversationId) {
        const chatName = name.trim() || "New Chat";
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({
            type: "direct",
            created_by: user.id,
            name: chatName,
          })
          .select()
          .single();

        if (convError) throw convError;
        targetConversationId = newConv.id;
      }

      // Create the invite link pointing to the conversation
      const { data, error } = await supabase
        .from("chat_invite_links")
        .insert({
          created_by: user.id,
          conversation_id: targetConversationId,
          conversation_name: null,
        })
        .select()
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/join/${data.token}`;
      setInviteLink(link);
      setCreatedConversationId(targetConversationId);
      toast.success("Invite link created!");
    } catch (error) {
      console.error("Error creating invite link:", error);
      toast.error("Failed to create invite link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after animation
    setTimeout(() => {
      setName("");
      setInviteLink(null);
      setCreatedConversationId(null);
      setCopied(false);
    }, 200);
  };

  const handleGoToChat = () => {
    if (createdConversationId) {
      navigate(`/chat/${createdConversationId}`);
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <UserPlus className="w-5 h-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-5 h-5 text-primary" />
            Invite to Chat
          </DialogTitle>
          <DialogDescription>
            Create a one-time invite link. The recipient can join anonymously and optionally save their account later.
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <div className="space-y-4 py-4">
            {!conversationId && (
              <div className="space-y-2">
                <Label htmlFor="chat-name">Chat name (optional)</Label>
                <Input
                  id="chat-name"
                  placeholder="e.g., Project Discussion"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            
            {conversationId && (
              <p className="text-sm text-muted-foreground">
                Inviting to: <span className="font-medium text-foreground">{conversationName || "this chat"}</span>
              </p>
            )}

            <Button 
              onClick={handleCreate} 
              disabled={loading}
              className="w-full gradient-valhalla hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4 mr-2" />
                  Create Invite Link
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Input
                value={inviteLink}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              This link can only be used once. Share it privately!
            </p>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="flex-1"
              >
                Done
              </Button>
              {createdConversationId && !conversationId && (
                <Button 
                  onClick={handleGoToChat}
                  className="flex-1 gradient-valhalla hover:opacity-90"
                >
                  Go to Chat
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
