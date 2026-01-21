import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CodeSandboxState {
  code: string;
  language: "javascript" | "typescript";
  lastOutput: string;
  updatedBy: string | null;
}

interface UseCodeSandboxOptions {
  roomId: string;
  userId: string;
}

interface ExecutionResult {
  output: string;
  error: string | null;
  executionTime: number;
}

export function useCodeSandbox({ roomId, userId }: UseCodeSandboxOptions) {
  const [state, setState] = useState<CodeSandboxState>({
    code: '// Write your JavaScript/TypeScript code here\nconsole.log("Hello, World!");',
    language: "javascript",
    lastOutput: "",
    updatedBy: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSyncing = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial state
  const loadState = useCallback(async () => {
    if (!roomId) return;

    try {
      // First get or create the row using the generic JSON query
      const { data, error } = await supabase
        .from("room_code_sandbox" as any)
        .select("*")
        .eq("room_id", roomId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading code sandbox:", error);
        return;
      }

      if (data) {
        setState({
          code: (data as any).code || "",
          language: (data as any).language || "javascript",
          lastOutput: (data as any).last_output || "",
          updatedBy: (data as any).updated_by,
        });
      }
    } catch (err) {
      console.error("Error loading sandbox state:", err);
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  // Save state to database
  const saveState = useCallback(
    async (newCode: string, newLanguage: string, newOutput?: string) => {
      if (!roomId || !userId || isSyncing.current) return;

      setIsSaving(true);
      try {
        // Check if record exists using generic query
        const { data: existing } = await supabase
          .from("room_code_sandbox" as any)
          .select("id")
          .eq("room_id", roomId)
          .maybeSingle();

        const updateData = {
          code: newCode,
          language: newLanguage,
          updated_by: userId,
          updated_at: new Date().toISOString(),
          ...(newOutput !== undefined && { last_output: newOutput }),
        };

        if (existing) {
          await supabase
            .from("room_code_sandbox" as any)
            .update(updateData)
            .eq("room_id", roomId);
        } else {
          await supabase.from("room_code_sandbox" as any).insert({
            room_id: roomId,
            ...updateData,
          });
        }
      } catch (err) {
        console.error("Error saving sandbox state:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [roomId, userId]
  );

  // Debounced save
  const debouncedSave = useCallback(
    (newCode: string, newLanguage: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveState(newCode, newLanguage);
      }, 500);
    },
    [saveState]
  );

  // Update code (local + sync)
  const updateCode = useCallback(
    (newCode: string) => {
      setState((prev) => ({ ...prev, code: newCode, updatedBy: userId }));
      debouncedSave(newCode, state.language);
    },
    [debouncedSave, state.language, userId]
  );

  // Update language
  const updateLanguage = useCallback(
    (newLanguage: "javascript" | "typescript") => {
      setState((prev) => ({ ...prev, language: newLanguage }));
      debouncedSave(state.code, newLanguage);
    },
    [debouncedSave, state.code]
  );

  // Execute code in sandboxed environment
  const executeCode = useCallback(async (): Promise<ExecutionResult> => {
    setIsExecuting(true);
    const startTime = performance.now();

    try {
      // Create a sandboxed execution environment
      const logs: string[] = [];
      const errors: string[] = [];

      // Create mock console
      const mockConsole = {
        log: (...args: unknown[]) => {
          logs.push(args.map(formatValue).join(" "));
        },
        error: (...args: unknown[]) => {
          errors.push(`Error: ${args.map(formatValue).join(" ")}`);
        },
        warn: (...args: unknown[]) => {
          logs.push(`⚠️ ${args.map(formatValue).join(" ")}`);
        },
        info: (...args: unknown[]) => {
          logs.push(`ℹ️ ${args.map(formatValue).join(" ")}`);
        },
        table: (data: unknown) => {
          logs.push(formatValue(data));
        },
        clear: () => {
          logs.length = 0;
        },
        time: () => {},
        timeEnd: () => {},
        assert: (condition: unknown, ...args: unknown[]) => {
          if (!condition) {
            errors.push(`Assertion failed: ${args.map(formatValue).join(" ")}`);
          }
        },
      };

      let codeToRun = state.code;

      // Basic TypeScript to JavaScript transpilation (very simple)
      if (state.language === "typescript") {
        // Remove type annotations (basic)
        codeToRun = codeToRun
          .replace(/:\s*(string|number|boolean|any|void|never|unknown)\b/g, "")
          .replace(/:\s*\w+\[\]/g, "")
          .replace(/<[^>]+>/g, "")
          .replace(/\binterface\s+\w+\s*\{[^}]*\}/g, "")
          .replace(/\btype\s+\w+\s*=[^;]+;/g, "")
          .replace(/\bas\s+\w+/g, "");
      }

      // Create function with mock console
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction(
        "console",
        "setTimeout",
        "setInterval",
        "clearTimeout",
        "clearInterval",
        `
          "use strict";
          ${codeToRun}
        `
      );

      // Create safe timeout/interval (with limits)
      const timeouts: ReturnType<typeof setTimeout>[] = [];
      const safeSetTimeout = (cb: () => void, ms: number) => {
        const id = setTimeout(cb, Math.min(ms, 5000));
        timeouts.push(id);
        return id;
      };
      const safeSetInterval = (cb: () => void, ms: number) => {
        const id = setInterval(cb, Math.max(ms, 100));
        timeouts.push(id as unknown as ReturnType<typeof setTimeout>);
        return id;
      };
      const safeClearTimeout = (id: ReturnType<typeof setTimeout>) => {
        clearTimeout(id);
        const idx = timeouts.indexOf(id);
        if (idx > -1) timeouts.splice(idx, 1);
      };
      const safeClearInterval = (id: ReturnType<typeof setInterval>) => {
        clearInterval(id);
      };

      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Execution timeout (5s)")), 5000);
      });

      try {
        await Promise.race([
          fn(mockConsole, safeSetTimeout, safeSetInterval, safeClearTimeout, safeClearInterval),
          timeoutPromise,
        ]);
      } finally {
        // Cleanup all timeouts
        timeouts.forEach((id) => clearTimeout(id));
      }

      const executionTime = performance.now() - startTime;
      const output = [...logs, ...errors].join("\n") || "(No output)";

      // Save output
      await saveState(state.code, state.language, output);
      setState((prev) => ({ ...prev, lastOutput: output }));

      return {
        output,
        error: errors.length > 0 ? errors.join("\n") : null,
        executionTime,
      };
    } catch (err) {
      const executionTime = performance.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const output = `❌ ${errorMessage}`;

      await saveState(state.code, state.language, output);
      setState((prev) => ({ ...prev, lastOutput: output }));

      return {
        output,
        error: errorMessage,
        executionTime,
      };
    } finally {
      setIsExecuting(false);
    }
  }, [state.code, state.language, saveState]);

  // Format values for console output
  function formatValue(value: unknown): string {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;
    if (Array.isArray(value)) {
      if (value.length > 100) return `[Array(${value.length})]`;
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return "[Object]";
      }
    }
    return String(value);
  }

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomId || !userId) return;

    loadState();

    const channel = supabase
      .channel(`code-sandbox-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_code_sandbox",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const data = payload.new as any;
          const updatedBy = data?.updated_by;

          // Only sync if change was made by another user
          if (updatedBy !== userId && data) {
            isSyncing.current = true;
            setState({
              code: data.code || "",
              language: data.language || "javascript",
              lastOutput: data.last_output || "",
              updatedBy: data.updated_by,
            });
            setTimeout(() => {
              isSyncing.current = false;
            }, 100);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [roomId, userId, loadState]);

  return {
    code: state.code,
    language: state.language,
    lastOutput: state.lastOutput,
    updatedBy: state.updatedBy,
    isLoading,
    isExecuting,
    isSaving,
    updateCode,
    updateLanguage,
    executeCode,
  };
}
