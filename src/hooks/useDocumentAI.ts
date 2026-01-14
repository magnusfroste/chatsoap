import { useCallback, useRef } from "react";
import { toast } from "sonner";

interface Message {
  content: string;
  is_ai: boolean;
  display_name?: string;
}

interface DocumentInfo {
  url: string;
  name: string;
  mimeType: string;
}

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`;

export function useDocumentAI() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const analyzeDocument = useCallback(
    async (
      document: DocumentInfo,
      question: string,
      messageHistory: Message[],
      onDelta: (text: string) => void,
      onDone: (fullText: string) => void
    ) => {
      // Cancel any ongoing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(ANALYZE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            documentUrl: document.url,
            documentName: document.name,
            mimeType: document.mimeType,
            question,
            messageHistory,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 429) {
            toast.error("Rate limit. Vänta lite och försök igen.");
          } else if (response.status === 402) {
            toast.error("AI credits slut. Kontakta admin.");
          } else {
            toast.error(errorData.error || "Kunde inte analysera dokumentet");
          }
          return;
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let fullText = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                fullText += content;
                onDelta(content);
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Final flush
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                fullText += content;
                onDelta(content);
              }
            } catch {
              /* ignore */
            }
          }
        }

        onDone(fullText);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          console.log("Document analysis aborted");
          return;
        }
        console.error("Document analysis error:", error);
        toast.error("Något gick fel vid dokumentanalys");
      }
    },
    []
  );

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { analyzeDocument, cancelAnalysis };
}
