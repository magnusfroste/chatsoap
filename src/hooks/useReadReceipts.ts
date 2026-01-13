import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ReadReceipt {
  message_id: string;
  user_id: string;
  read_at: string;
}

export const useReadReceipts = (conversationId: string | undefined, userId: string | undefined) => {
  const [readReceipts, setReadReceipts] = useState<Map<string, ReadReceipt[]>>(new Map());

  // Fetch existing read receipts for the conversation
  const fetchReadReceipts = useCallback(async () => {
    if (!conversationId || !userId) return;

    try {
      // Get all message IDs in this conversation
      const { data: messages } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId);

      if (!messages || messages.length === 0) return;

      const messageIds = messages.map((m) => m.id);

      // Get read receipts for these messages
      const { data: receipts } = await supabase
        .from("message_read_receipts")
        .select("message_id, user_id, read_at")
        .in("message_id", messageIds);

      if (receipts) {
        const receiptMap = new Map<string, ReadReceipt[]>();
        receipts.forEach((receipt) => {
          const existing = receiptMap.get(receipt.message_id) || [];
          existing.push(receipt);
          receiptMap.set(receipt.message_id, existing);
        });
        setReadReceipts(receiptMap);
      }
    } catch (error) {
      console.error("Error fetching read receipts:", error);
    }
  }, [conversationId, userId]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
    if (!userId || messageIds.length === 0) return;

    try {
      // Filter out messages that are already marked as read by this user
      const unreadMessageIds = messageIds.filter((msgId) => {
        const receipts = readReceipts.get(msgId) || [];
        return !receipts.some((r) => r.user_id === userId);
      });

      if (unreadMessageIds.length === 0) return;

      // Insert read receipts (ignore conflicts)
      const receiptsToInsert = unreadMessageIds.map((message_id) => ({
        message_id,
        user_id: userId,
      }));

      const { error } = await supabase
        .from("message_read_receipts")
        .upsert(receiptsToInsert, { 
          onConflict: "message_id,user_id",
          ignoreDuplicates: true 
        });

      if (error) {
        console.error("Error marking messages as read:", error);
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  }, [userId, readReceipts]);

  // Check if a message has been read by someone other than the sender
  const isMessageRead = useCallback((messageId: string, senderId: string | null): boolean => {
    const receipts = readReceipts.get(messageId) || [];
    // Message is read if anyone other than the sender has read it
    return receipts.some((r) => r.user_id !== senderId);
  }, [readReceipts]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!conversationId || !userId) return;

    fetchReadReceipts();

    // Listen for new read receipts
    const channel = supabase
      .channel(`read-receipts-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_read_receipts",
        },
        (payload) => {
          const newReceipt = payload.new as ReadReceipt;
          setReadReceipts((prev) => {
            const updated = new Map(prev);
            const existing = updated.get(newReceipt.message_id) || [];
            // Avoid duplicates
            if (!existing.some((r) => r.user_id === newReceipt.user_id)) {
              updated.set(newReceipt.message_id, [...existing, newReceipt]);
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, fetchReadReceipts]);

  return {
    readReceipts,
    markMessagesAsRead,
    isMessageRead,
    fetchReadReceipts,
  };
};
