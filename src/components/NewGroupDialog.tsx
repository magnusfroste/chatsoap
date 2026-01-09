import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Users } from "lucide-react";

interface Profile {
  user_id: string;
  display_name: string;
}

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated: (conversationId: string) => void;
}

const NewGroupDialog = ({ open, onOpenChange, onGroupCreated }: NewGroupDialogProps) => {
  const { user } = useAuth();
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
      setGroupName("");
      setSelectedUsers([]);
      setSearchQuery("");
    }
  }, [open]);

  const fetchUsers = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .neq("user_id", user.id)
        .order("display_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!user || !groupName.trim() || creating) return;
    setCreating(true);

    try {
      // Create group conversation
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          type: "group",
          name: groupName.trim(),
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add creator and selected users as members
      const members = [user.id, ...selectedUsers].map((userId) => ({
        conversation_id: newConv.id,
        user_id: userId,
      }));

      const { error: membersError } = await supabase
        .from("conversation_members")
        .insert(members);

      if (membersError) throw membersError;

      onGroupCreated(newConv.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating group:", error);
    } finally {
      setCreating(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredUsers = users.filter((u) =>
    u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Skapa ny grupp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Gruppnamn</Label>
            <Input
              id="group-name"
              placeholder="T.ex. Projektteam"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Lägg till medlemmar (valfritt)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Sök användare..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {selectedUsers.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedUsers.length} användare valda
            </div>
          )}

          <ScrollArea className="h-[200px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Inga användare hittades
              </div>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map((u) => (
                  <label
                    key={u.user_id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(u.user_id)}
                      onCheckedChange={() => handleToggleUser(u.user_id)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        {getInitials(u.display_name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground text-sm">
                      {u.display_name || "Användare"}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || creating}
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Skapa grupp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewGroupDialog;
