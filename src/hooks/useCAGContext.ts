import { useState, useCallback, useEffect } from "react";

export interface CAGFile {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  messageId: string;
}

export interface CAGNote {
  id: string;
  title: string;
  content: string;
}

export type CAGItem = 
  | { type: "file"; data: CAGFile }
  | { type: "note"; data: CAGNote };

const STORAGE_KEY_PREFIX = "cag-context-";
const NOTES_STORAGE_KEY_PREFIX = "cag-notes-";

export function useCAGContext(conversationId: string | undefined) {
  const [selectedFiles, setSelectedFiles] = useState<CAGFile[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<CAGNote[]>([]);

  // Load saved file context from localStorage on mount
  useEffect(() => {
    if (!conversationId) {
      setSelectedFiles([]);
      return;
    }

    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${conversationId}`);
    if (saved) {
      try {
        setSelectedFiles(JSON.parse(saved));
      } catch {
        setSelectedFiles([]);
      }
    } else {
      setSelectedFiles([]);
    }
  }, [conversationId]);

  // Load saved note context from localStorage on mount
  useEffect(() => {
    if (!conversationId) {
      setSelectedNotes([]);
      return;
    }

    const saved = localStorage.getItem(`${NOTES_STORAGE_KEY_PREFIX}${conversationId}`);
    if (saved) {
      try {
        setSelectedNotes(JSON.parse(saved));
      } catch {
        setSelectedNotes([]);
      }
    } else {
      setSelectedNotes([]);
    }
  }, [conversationId]);

  // Save files to localStorage when they change
  useEffect(() => {
    if (!conversationId) return;
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${conversationId}`,
      JSON.stringify(selectedFiles)
    );
  }, [selectedFiles, conversationId]);

  // Save notes to localStorage when they change
  useEffect(() => {
    if (!conversationId) return;
    localStorage.setItem(
      `${NOTES_STORAGE_KEY_PREFIX}${conversationId}`,
      JSON.stringify(selectedNotes)
    );
  }, [selectedNotes, conversationId]);

  // File operations
  const addFile = useCallback((file: CAGFile) => {
    setSelectedFiles((prev) => {
      if (prev.find((f) => f.id === file.id)) return prev;
      return [...prev, file];
    });
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const toggleFile = useCallback((file: CAGFile) => {
    setSelectedFiles((prev) => {
      const exists = prev.find((f) => f.id === file.id);
      if (exists) {
        return prev.filter((f) => f.id !== file.id);
      }
      return [...prev, file];
    });
  }, []);

  const isFileSelected = useCallback(
    (fileId: string) => selectedFiles.some((f) => f.id === fileId),
    [selectedFiles]
  );

  // Note operations
  const addNote = useCallback((note: CAGNote) => {
    setSelectedNotes((prev) => {
      if (prev.find((n) => n.id === note.id)) return prev;
      return [...prev, note];
    });
  }, []);

  const removeNote = useCallback((noteId: string) => {
    setSelectedNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const toggleNote = useCallback((note: CAGNote) => {
    setSelectedNotes((prev) => {
      const exists = prev.find((n) => n.id === note.id);
      if (exists) {
        return prev.filter((n) => n.id !== note.id);
      }
      return [...prev, note];
    });
  }, []);

  const isNoteSelected = useCallback(
    (noteId: string) => selectedNotes.some((n) => n.id === noteId),
    [selectedNotes]
  );

  // Clear all
  const clearAll = useCallback(() => {
    setSelectedFiles([]);
    setSelectedNotes([]);
  }, []);

  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  const clearNotes = useCallback(() => {
    setSelectedNotes([]);
  }, []);

  // Combined items for display
  const getAllItems = useCallback((): CAGItem[] => {
    const fileItems: CAGItem[] = selectedFiles.map(f => ({ type: "file", data: f }));
    const noteItems: CAGItem[] = selectedNotes.map(n => ({ type: "note", data: n }));
    return [...fileItems, ...noteItems];
  }, [selectedFiles, selectedNotes]);

  return {
    // Files
    selectedFiles,
    addFile,
    removeFile,
    toggleFile,
    isFileSelected,
    clearFiles,
    fileCount: selectedFiles.length,
    
    // Notes
    selectedNotes,
    addNote,
    removeNote,
    toggleNote,
    isNoteSelected,
    clearNotes,
    noteCount: selectedNotes.length,
    
    // Combined
    clearAll,
    totalCount: selectedFiles.length + selectedNotes.length,
    getAllItems,
  };
}
