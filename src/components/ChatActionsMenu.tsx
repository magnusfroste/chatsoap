import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Pin,
  Star,
  Archive,
  BellOff,
  Bell,
  User,
  FileDown,
  Trash2,
  ArchiveRestore,
  PinOff,
  StarOff,
} from "lucide-react";
import { useChatActions, ChatMemberSettings } from "@/hooks/useChatActions";

interface ChatActionsMenuProps {
  conversationId: string;
  userId: string | undefined;
  chatName: string;
  isGroup?: boolean;
  onContactInfo?: () => void;
  onDeleted?: () => void;
}

export const ChatActionsMenu = ({
  conversationId,
  userId,
  chatName,
  isGroup = false,
  onContactInfo,
  onDeleted,
}: ChatActionsMenuProps) => {
  const [settings, setSettings] = useState<ChatMemberSettings | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"soft" | "hard">("soft");

  const {
    loading,
    getMemberSettings,
    togglePin,
    toggleFavorite,
    toggleMute,
    toggleArchive,
    softDeleteChat,
    hardDeleteChat,
    exportChat,
  } = useChatActions(userId);

  useEffect(() => {
    if (userId && conversationId) {
      getMemberSettings(conversationId).then(setSettings);
    }
  }, [userId, conversationId, getMemberSettings]);

  const handleTogglePin = async () => {
    if (!settings) return;
    const success = await togglePin(conversationId, settings.is_pinned);
    if (success) {
      setSettings({ ...settings, is_pinned: !settings.is_pinned });
    }
  };

  const handleToggleFavorite = async () => {
    if (!settings) return;
    const success = await toggleFavorite(conversationId, settings.is_favorite);
    if (success) {
      setSettings({ ...settings, is_favorite: !settings.is_favorite });
    }
  };

  const handleToggleMute = async () => {
    if (!settings) return;
    const success = await toggleMute(conversationId, settings.is_muted);
    if (success) {
      setSettings({ ...settings, is_muted: !settings.is_muted });
    }
  };

  const handleToggleArchive = async () => {
    if (!settings) return;
    const success = await toggleArchive(conversationId, settings.is_archived);
    if (success) {
      setSettings({ ...settings, is_archived: !settings.is_archived });
    }
  };

  const handleExport = () => {
    exportChat(conversationId, chatName);
  };

  const handleDeleteClick = (type: "soft" | "hard") => {
    setDeleteType(type);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    let success = false;
    if (deleteType === "soft") {
      success = await softDeleteChat(conversationId);
    } else {
      success = await hardDeleteChat(conversationId);
    }
    
    if (success) {
      setDeleteDialogOpen(false);
      onDeleted?.();
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {!isGroup && onContactInfo && (
            <DropdownMenuItem onClick={onContactInfo}>
              <User className="h-4 w-4 mr-2" />
              Contact info
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem onClick={handleTogglePin} disabled={loading}>
            {settings?.is_pinned ? (
              <>
                <PinOff className="h-4 w-4 mr-2" />
                Unpin chat
              </>
            ) : (
              <>
                <Pin className="h-4 w-4 mr-2" />
                Pin chat
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleToggleFavorite} disabled={loading}>
            {settings?.is_favorite ? (
              <>
                <StarOff className="h-4 w-4 mr-2" />
                Remove from favorites
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Add to favorites
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleToggleMute} disabled={loading}>
            {settings?.is_muted ? (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Enable notifications
              </>
            ) : (
              <>
                <BellOff className="h-4 w-4 mr-2" />
                Mute notifications
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleToggleArchive} disabled={loading}>
            {settings?.is_archived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" />
                Unarchive chat
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                Archive chat
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleExport} disabled={loading}>
            <FileDown className="h-4 w-4 mr-2" />
            Export chat
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem 
            onClick={() => handleDeleteClick("soft")} 
            disabled={loading}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete chat
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => handleDeleteClick("hard")} 
            disabled={loading}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteType === "soft" ? "Delete chat?" : "Delete chat permanently?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === "soft" 
                ? "The chat will be hidden but can be restored later."
                : "This action cannot be undone. The chat will be permanently deleted."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteType === "soft" ? "Delete" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
