import { useState, useCallback, useEffect } from "react";

export interface CAGFile {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  messageId: string;
}

const STORAGE_KEY_PREFIX = "cag-context-";

export function useCAGContext(conversationId: string | undefined) {
  const [selectedFiles, setSelectedFiles] = useState<CAGFile[]>([]);

  // Load saved context from localStorage on mount
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

  // Save to localStorage when files change
  useEffect(() => {
    if (!conversationId) return;
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${conversationId}`,
      JSON.stringify(selectedFiles)
    );
  }, [selectedFiles, conversationId]);

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

  const clearAll = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  return {
    selectedFiles,
    addFile,
    removeFile,
    toggleFile,
    isFileSelected,
    clearAll,
    fileCount: selectedFiles.length,
  };
}
