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
              Kontaktinfo
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem onClick={handleTogglePin} disabled={loading}>
            {settings?.is_pinned ? (
              <>
                <PinOff className="h-4 w-4 mr-2" />
                Avfäst chatt
              </>
            ) : (
              <>
                <Pin className="h-4 w-4 mr-2" />
                Fäst chatt
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleToggleFavorite} disabled={loading}>
            {settings?.is_favorite ? (
              <>
                <StarOff className="h-4 w-4 mr-2" />
                Ta bort från favoriter
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Lägg till i favoriter
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleToggleMute} disabled={loading}>
            {settings?.is_muted ? (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Slå på aviseringar
              </>
            ) : (
              <>
                <BellOff className="h-4 w-4 mr-2" />
                Stäng av aviseringar
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleToggleArchive} disabled={loading}>
            {settings?.is_archived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" />
                Avarkivera chatt
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                Arkivera chatt
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleExport} disabled={loading}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportera chatt
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem 
            onClick={() => handleDeleteClick("soft")} 
            disabled={loading}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Ta bort chatt
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => handleDeleteClick("hard")} 
            disabled={loading}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Ta bort permanent
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteType === "soft" ? "Ta bort chatt?" : "Ta bort chatt permanent?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === "soft" 
                ? "Chatten kommer att döljas men kan återställas senare."
                : "Denna åtgärd kan inte ångras. Chatten kommer att tas bort permanent."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteType === "soft" ? "Ta bort" : "Ta bort permanent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
