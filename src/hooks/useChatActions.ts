import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChatMemberSettings {
  is_archived: boolean;
  is_pinned: boolean;
  is_muted: boolean;
  is_favorite: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
}

export const useChatActions = (userId: string | undefined) => {
  const [loading, setLoading] = useState(false);

  const getMemberSettings = useCallback(async (conversationId: string): Promise<ChatMemberSettings | null> => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from("conversation_members")
      .select("is_archived, is_pinned, is_muted, is_favorite, is_deleted, deleted_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching member settings:", error);
      return null;
    }

    return data as ChatMemberSettings;
  }, [userId]);

  const updateMemberSetting = useCallback(async (
    conversationId: string,
    setting: Partial<ChatMemberSettings>
  ): Promise<boolean> => {
    if (!userId) return false;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("conversation_members")
        .update(setting)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error updating setting:", error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const togglePin = useCallback(async (conversationId: string, currentValue: boolean) => {
    const success = await updateMemberSetting(conversationId, { is_pinned: !currentValue });
    if (success) {
      toast.success(currentValue ? "Chat unpinned" : "Chat pinned");
    }
    return success;
  }, [updateMemberSetting]);

  const toggleFavorite = useCallback(async (conversationId: string, currentValue: boolean) => {
    const success = await updateMemberSetting(conversationId, { is_favorite: !currentValue });
    if (success) {
      toast.success(currentValue ? "Removed from favorites" : "Added to favorites");
    }
    return success;
  }, [updateMemberSetting]);

  const toggleMute = useCallback(async (conversationId: string, currentValue: boolean) => {
    const success = await updateMemberSetting(conversationId, { is_muted: !currentValue });
    if (success) {
      toast.success(currentValue ? "Notifications enabled" : "Notifications muted");
    }
    return success;
  }, [updateMemberSetting]);

  const toggleArchive = useCallback(async (conversationId: string, currentValue: boolean) => {
    const success = await updateMemberSetting(conversationId, { is_archived: !currentValue });
    if (success) {
      toast.success(currentValue ? "Chat unarchived" : "Chat archived");
    }
    return success;
  }, [updateMemberSetting]);

  const softDeleteChat = useCallback(async (conversationId: string) => {
    const success = await updateMemberSetting(conversationId, { 
      is_deleted: true, 
      deleted_at: new Date().toISOString() 
    });
    if (success) {
      toast.success("Chat deleted");
    }
    return success;
  }, [updateMemberSetting]);

  const restoreChat = useCallback(async (conversationId: string) => {
    const success = await updateMemberSetting(conversationId, { 
      is_deleted: false, 
      deleted_at: null 
    });
    if (success) {
      toast.success("Chat restored");
    }
    return success;
  }, [updateMemberSetting]);

  const hardDeleteChat = useCallback(async (conversationId: string) => {
    if (!userId) return false;
    setLoading(true);

    try {
      // Remove user from conversation (this effectively deletes it for this user)
      const { error } = await supabase
        .from("conversation_members")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      if (error) throw error;
      toast.success("Chat permanently deleted");
      return true;
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast.error("Could not delete chat");
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const exportChat = useCallback(async (conversationId: string, chatName: string) => {
    if (!userId) return;
    setLoading(true);

    try {
      const { data: messages, error } = await supabase
        .from("messages")
        .select("content, created_at, is_ai, user_id")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Get profiles for user messages
      const userIds = [...new Set(messages?.filter(m => m.user_id).map(m => m.user_id))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      // Format messages
      const formattedMessages = messages?.map(m => {
        const date = new Date(m.created_at).toLocaleString("en-US");
        const sender = m.is_ai ? "AI" : (m.user_id ? (profileMap.get(m.user_id) || "User") : "System");
        return `[${date}] ${sender}: ${m.content}`;
      }).join("\n\n");

      // Create and download file
      const blob = new Blob([`Chat Export: ${chatName}\n${"=".repeat(50)}\n\n${formattedMessages}`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${chatName.replace(/[^a-zA-Z0-9]/g, "_")}_export.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Chat exported");
    } catch (error) {
      console.error("Error exporting chat:", error);
      toast.error("Could not export chat");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    loading,
    getMemberSettings,
    togglePin,
    toggleFavorite,
    toggleMute,
    toggleArchive,
    softDeleteChat,
    restoreChat,
    hardDeleteChat,
    exportChat,
  };
};
