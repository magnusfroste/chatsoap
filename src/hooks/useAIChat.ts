import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  is_ai: boolean;
  user_id: string | null;
  created_at: string;
  profile?: {
    display_name: string | null;
  };
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/room-ai-chat`;

export function useAIChat(roomId: string | undefined) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamAIResponse = useCallback(
    async (
      messageHistory: Message[],
      onDelta: (text: string) => void,
      onDone: (fullText: string) => void
    ) => {
      if (!roomId) return;

      // Cancel any ongoing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const historyForAI = messageHistory.map((msg) => ({
          content: msg.content,
          is_ai: msg.is_ai,
          display_name: msg.profile?.display_name || "Anonym",
        }));

        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ roomId, messageHistory: historyForAI }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 429) {
            toast.error("Rate limit. Vänta lite och försök igen.");
          } else if (response.status === 402) {
            toast.error("AI credits slut. Kontakta admin.");
          } else {
            toast.error(errorData.error || "Kunde inte nå AI:n");
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
              // Incomplete JSON, put back and wait
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
          console.log("AI stream aborted");
          return;
        }
        console.error("AI stream error:", error);
        toast.error("Något gick fel med AI:n");
      }
    },
    [roomId]
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { streamAIResponse, cancelStream };
}