import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Note {
  id: string;
  user_id: string;
  conversation_id: string | null;
  room_id: string | null;
  source_message_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const useNotes = (userId: string | undefined) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchNotes = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
      toast({
        title: "Error",
        description: "Could not load notes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notes-changes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNote = payload.new as Note;
          setNotes((prev) => {
            // Avoid duplicates
            if (prev.some((n) => n.id === newNote.id)) return prev;
            return [newNote, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updatedNote = payload.new as Note;
          setNotes((prev) =>
            prev.map((note) =>
              note.id === updatedNote.id ? updatedNote : note
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const deletedNote = payload.old as Note;
          setNotes((prev) => prev.filter((note) => note.id !== deletedNote.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const createNote = useCallback(
    async (params: {
      title?: string;
      content: string;
      conversationId?: string;
      roomId?: string;
      sourceMessageId?: string;
    }) => {
      if (!userId) return null;

      // Create optimistic note
      const tempId = `temp-${Date.now()}`;
      const optimisticNote: Note = {
        id: tempId,
        user_id: userId,
        title: params.title || "Untitled Note",
        content: params.content,
        conversation_id: params.conversationId || null,
        room_id: params.roomId || null,
        source_message_id: params.sourceMessageId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add optimistically
      setNotes((prev) => [optimisticNote, ...prev]);

      try {
        const { data, error } = await supabase
          .from("notes")
          .insert({
            user_id: userId,
            title: params.title || "Untitled Note",
            content: params.content,
            conversation_id: params.conversationId || null,
            room_id: params.roomId || null,
            source_message_id: params.sourceMessageId || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Replace optimistic note with real one
        setNotes((prev) =>
          prev.map((n) => (n.id === tempId ? (data as Note) : n))
        );

        toast({
          title: "Note created",
          description: "Message saved to notes",
        });

        return data as Note;
      } catch (error) {
        // Remove optimistic note on error
        setNotes((prev) => prev.filter((n) => n.id !== tempId));
        console.error("Error creating note:", error);
        toast({
          title: "Error",
          description: "Could not create note",
          variant: "destructive",
        });
        return null;
      }
    },
    [userId, toast]
  );

  const updateNote = useCallback(
    async (noteId: string, updates: { title?: string; content?: string }) => {
      try {
        const { data, error } = await supabase
          .from("notes")
          .update(updates)
          .eq("id", noteId)
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Note saved",
          description: "Your changes have been saved",
        });

        return data as Note;
      } catch (error) {
        console.error("Error updating note:", error);
        toast({
          title: "Error",
          description: "Could not save note",
          variant: "destructive",
        });
        return null;
      }
    },
    [toast]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      // Optimistically remove from UI immediately
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      
      try {
        const { error } = await supabase.from("notes").delete().eq("id", noteId);

        if (error) throw error;

        toast({
          title: "Note deleted",
          description: "Note has been removed",
        });

        return true;
      } catch (error) {
        // Refetch on error to restore the note
        console.error("Error deleting note:", error);
        fetchNotes();
        toast({
          title: "Error",
          description: "Could not delete note",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast, fetchNotes]
  );

  return {
    notes,
    isLoading,
    createNote,
    updateNote,
    deleteNote,
    refetch: fetchNotes,
  };
};
