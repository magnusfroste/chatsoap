import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Transformation {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  icon: string | null;
  isDefault: boolean;
  userId: string;
}

interface CreateTransformationInput {
  name: string;
  description?: string;
  prompt: string;
  icon?: string;
}

interface RunTransformationOptions {
  transformationId: string;
  content: string;
  targetLanguage?: string;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: string) => void;
}

export function useTransformations() {
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch all transformations (built-in + user's custom)
  const fetchTransformations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("transformations")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");

      if (error) throw error;

      const mapped: Transformation[] = (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        prompt: t.prompt,
        icon: t.icon,
        isDefault: t.is_default || false,
        userId: t.user_id,
      }));

      setTransformations(mapped);
    } catch (error) {
      console.error("Error fetching transformations:", error);
      toast.error("Failed to load transformations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransformations();
  }, [fetchTransformations]);

  // Create a new custom transformation
  const createTransformation = useCallback(
    async (input: CreateTransformationInput): Promise<Transformation | null> => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("You must be logged in");
          return null;
        }

        const { data, error } = await supabase
          .from("transformations")
          .insert({
            user_id: user.id,
            name: input.name,
            description: input.description || null,
            prompt: input.prompt,
            icon: input.icon || "wand-2",
            is_default: false,
          })
          .select()
          .single();

        if (error) throw error;

        const newTransformation: Transformation = {
          id: data.id,
          name: data.name,
          description: data.description,
          prompt: data.prompt,
          icon: data.icon,
          isDefault: false,
          userId: data.user_id,
        };

        setTransformations((prev) => [...prev, newTransformation]);
        toast.success("Transformation created");
        return newTransformation;
      } catch (error) {
        console.error("Error creating transformation:", error);
        toast.error("Failed to create transformation");
        return null;
      }
    },
    []
  );

  // Update an existing custom transformation
  const updateTransformation = useCallback(
    async (id: string, input: Partial<CreateTransformationInput>): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("transformations")
          .update({
            name: input.name,
            description: input.description,
            prompt: input.prompt,
            icon: input.icon,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) throw error;

        setTransformations((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  name: input.name ?? t.name,
                  description: input.description ?? t.description,
                  prompt: input.prompt ?? t.prompt,
                  icon: input.icon ?? t.icon,
                }
              : t
          )
        );

        toast.success("Transformation updated");
        return true;
      } catch (error) {
        console.error("Error updating transformation:", error);
        toast.error("Failed to update transformation");
        return false;
      }
    },
    []
  );

  // Delete a custom transformation
  const deleteTransformation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("transformations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setTransformations((prev) => prev.filter((t) => t.id !== id));
      toast.success("Transformation deleted");
      return true;
    } catch (error) {
      console.error("Error deleting transformation:", error);
      toast.error("Failed to delete transformation");
      return false;
    }
  }, []);

  // Run a transformation on content (streaming)
  const runTransformation = useCallback(
    async (options: RunTransformationOptions): Promise<string | null> => {
      const { transformationId, content, targetLanguage, onChunk, onComplete, onError } = options;

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsProcessing(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const errorMsg = "You must be logged in";
          onError?.(errorMsg);
          toast.error(errorMsg);
          return null;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transform-content`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              transformationId,
              content,
              targetLanguage,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to run transformation");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim() !== "");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullText += parsed.content;
                  onChunk?.(parsed.content);
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        onComplete?.(fullText);
        return fullText;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          console.log("Transformation cancelled");
          return null;
        }

        const errorMsg = (error as Error).message || "Transformation failed";
        console.error("Error running transformation:", error);
        onError?.(errorMsg);
        toast.error(errorMsg);
        return null;
      } finally {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  // Cancel ongoing transformation
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsProcessing(false);
    }
  }, []);

  return {
    transformations,
    isLoading,
    isProcessing,
    createTransformation,
    updateTransformation,
    deleteTransformation,
    runTransformation,
    cancel,
    refetch: fetchTransformations,
  };
}
