import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, Copy, Check, Trash2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";

interface InviteLink {
  id: string;
  token: string;
  conversation_id: string | null;
  conversation_name: string | null;
  created_at: string;
  used_at: string | null;
  used_by: string | null;
}

interface MyInviteLinksDialogProps {
  trigger?: React.ReactNode;
}

export default function MyInviteLinksDialog({ trigger }: MyInviteLinksDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLinks = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_invite_links")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error("Error fetching invite links:", error);
      toast.error("Could not fetch invite links");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLinks();
    }
  }, [open, user]);

  const handleCopy = async (link: InviteLink) => {
    const url = `${window.location.origin}/join/${link.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      toast.success("Link copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleDelete = async (link: InviteLink) => {
    setDeletingId(link.id);
    try {
      const { error } = await supabase
        .from("chat_invite_links")
        .delete()
        .eq("id", link.id);

      if (error) throw error;
      
      setLinks(prev => prev.filter(l => l.id !== link.id));
      toast.success("Invite link removed");
    } catch (error) {
      console.error("Error deleting invite link:", error);
      toast.error("Could not remove link");
    } finally {
      setDeletingId(null);
    }
  };

  const activeLinks = links.filter(l => !l.used_at);
  const usedLinks = links.filter(l => l.used_at);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <Link className="w-4 h-4 mr-2" />
            My invite links
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-5 h-5 text-primary" />
            My Invite Links
          </DialogTitle>
          <DialogDescription>
            Manage your created invite links
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>You don't have any invite links yet</p>
            <p className="text-sm mt-1">Create one via the menu in the chat sidebar</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-4">
              {/* Active links */}
              {activeLinks.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Active ({activeLinks.length})
                  </h4>
                  <div className="space-y-2">
                    {activeLinks.map((link) => (
                      <LinkCard
                        key={link.id}
                        link={link}
                        onCopy={() => handleCopy(link)}
                        onDelete={() => handleDelete(link)}
                        isCopied={copiedId === link.id}
                        isDeleting={deletingId === link.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Used links */}
              {usedLinks.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Used ({usedLinks.length})
                  </h4>
                  <div className="space-y-2">
                    {usedLinks.map((link) => (
                      <LinkCard
                        key={link.id}
                        link={link}
                        onCopy={() => handleCopy(link)}
                        onDelete={() => handleDelete(link)}
                        isCopied={copiedId === link.id}
                        isDeleting={deletingId === link.id}
                        isUsed
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface LinkCardProps {
  link: InviteLink;
  onCopy: () => void;
  onDelete: () => void;
  isCopied: boolean;
  isDeleting: boolean;
  isUsed?: boolean;
}

function LinkCard({ link, onCopy, onDelete, isCopied, isDeleting, isUsed }: LinkCardProps) {
  const displayName = link.conversation_name || (link.conversation_id ? "Existing chat" : "New chat");
  
  return (
    <div className={`p-3 rounded-lg border ${isUsed ? 'bg-muted/50 border-border/50' : 'bg-card border-border'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`font-medium truncate ${isUsed ? 'text-muted-foreground' : 'text-foreground'}`}>
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(link.created_at), { 
              addSuffix: true, 
              locale: enUS 
            })}
            {isUsed && link.used_at && (
              <span className="ml-2">
                • Used {formatDistanceToNow(new Date(link.used_at), { 
                  addSuffix: true, 
                  locale: enUS 
                })}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          {!isUsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onCopy}
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
