import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const NOTES_AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notes-ai`;

export type NoteAIAction = "summarize" | "enhance" | "translate";

export const useNoteAI = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const processNote = useCallback(
    async (
      action: NoteAIAction,
      content: string,
      targetLanguage?: string,
      onDelta?: (text: string) => void,
      onDone?: (fullText: string) => void
    ) => {
      if (!content.trim()) {
        toast({
          title: "Empty content",
          description: "Please add some text first",
          variant: "destructive",
        });
        return null;
      }

      abortControllerRef.current = new AbortController();
      setIsProcessing(true);

      try {
        const response = await fetch(NOTES_AI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action, content, targetLanguage }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const deltaContent = parsed.choices?.[0]?.delta?.content;
              if (deltaContent) {
                fullText += deltaContent;
                onDelta?.(deltaContent);
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        onDone?.(fullText);
        return fullText;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          console.log("AI processing cancelled");
          return null;
        }
        console.error("Note AI error:", error);
        toast({
          title: "AI Error",
          description: (error as Error).message || "Could not process note",
          variant: "destructive",
        });
        return null;
      } finally {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
    },
    [toast]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    processNote,
    isProcessing,
    cancel,
  };
};
