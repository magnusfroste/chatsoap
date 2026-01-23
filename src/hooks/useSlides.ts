import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { emitOpenApp } from "@/lib/canvas-apps/events";

export interface Slide {
  id: string;
  title: string;
  content: string;
  notes?: string;
  layout: "title" | "title-content" | "two-column" | "bullets" | "quote";
}

export interface SlidesState {
  slides: Slide[];
  currentSlide: number;
  theme: "dark" | "light" | "minimal" | "bold";
  title: string;
  presentingUserId: string | null;
  presentingStartedAt: string | null;
}

const defaultState: SlidesState = {
  slides: [],
  currentSlide: 0,
  theme: "dark",
  title: "Untitled Presentation",
  presentingUserId: null,
  presentingStartedAt: null,
};

export function useSlides(roomId: string | undefined) {
  const { user } = useAuth();
  const [state, setState] = useState<SlidesState>(defaultState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const isSyncing = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Load slides from database
  const loadSlides = useCallback(async () => {
    if (!roomId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("room_slides")
        .select("*")
        .eq("room_id", roomId)
        .maybeSingle();

      if (error) {
        console.log("No existing slides or RLS error:", error.message);
      }

      if (data) {
        const slidesData = data.slides as unknown;
        setState({
          slides: Array.isArray(slidesData) ? (slidesData as Slide[]) : [],
          currentSlide: data.current_slide ?? 0,
          theme: (data.theme as SlidesState["theme"]) ?? "dark",
          title: data.title ?? "Untitled Presentation",
          presentingUserId: (data as { presenting_user_id?: string }).presenting_user_id ?? null,
          presentingStartedAt: (data as { presenting_started_at?: string }).presenting_started_at ?? null,
        });
      }
    } catch (err) {
      console.error("Error loading slides:", err);
    }

    setIsLoading(false);
  }, [roomId]);

  // Save slides to database
  const saveSlides = useCallback(
    async (newState: SlidesState) => {
      if (!roomId || !user || isSyncing.current) return;

      setIsSaving(true);

      try {
        const { data: existing } = await supabase
          .from("room_slides")
          .select("id")
          .eq("room_id", roomId)
          .maybeSingle();

        const slidesJson = JSON.parse(JSON.stringify(newState.slides)) as unknown as import("@/integrations/supabase/types").Json;

        if (existing) {
          await supabase
            .from("room_slides")
            .update({
              slides: slidesJson as any,
              current_slide: newState.currentSlide,
              theme: newState.theme,
              title: newState.title,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            } as any)
            .eq("room_id", roomId);
        } else {
          await supabase.from("room_slides").insert({
            room_id: roomId,
            slides: slidesJson as any,
            current_slide: newState.currentSlide,
            theme: newState.theme,
            title: newState.title,
            updated_by: user.id,
          } as any);
        }
      } catch (err) {
        console.error("Error saving slides:", err);
      }

      setIsSaving(false);
    },
    [roomId, user]
  );

  // Debounced save
  const debouncedSave = useCallback(
    (newState: SlidesState) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        saveSlides(newState);
      }, 500);
    },
    [saveSlides]
  );

  // Update state and trigger save
  const updateState = useCallback(
    (updates: Partial<SlidesState>) => {
      setState((prev) => {
        const newState = { ...prev, ...updates };
        debouncedSave(newState);
        return newState;
      });
    },
    [debouncedSave]
  );

  // Slide operations
  const addSlide = useCallback(
    (slide: Slide, position?: number) => {
      setState((prev) => {
        const newSlides = [...prev.slides];
        const insertPos = position ?? newSlides.length;
        newSlides.splice(insertPos, 0, slide);
        const newState = { ...prev, slides: newSlides };
        debouncedSave(newState);
        return newState;
      });
    },
    [debouncedSave]
  );

  const updateSlide = useCallback(
    (slideId: string, updates: Partial<Slide>) => {
      setState((prev) => {
        const newSlides = prev.slides.map((s) =>
          s.id === slideId ? { ...s, ...updates } : s
        );
        const newState = { ...prev, slides: newSlides };
        debouncedSave(newState);
        return newState;
      });
    },
    [debouncedSave]
  );

  const deleteSlide = useCallback(
    (slideId: string) => {
      setState((prev) => {
        const newSlides = prev.slides.filter((s) => s.id !== slideId);
        const newCurrentSlide = Math.min(
          prev.currentSlide,
          Math.max(0, newSlides.length - 1)
        );
        const newState = {
          ...prev,
          slides: newSlides,
          currentSlide: newCurrentSlide,
        };
        debouncedSave(newState);
        return newState;
      });
    },
    [debouncedSave]
  );

  const reorderSlides = useCallback(
    (fromIndex: number, toIndex: number) => {
      setState((prev) => {
        const newSlides = [...prev.slides];
        const [moved] = newSlides.splice(fromIndex, 1);
        newSlides.splice(toIndex, 0, moved);
        const newState = { ...prev, slides: newSlides };
        debouncedSave(newState);
        return newState;
      });
    },
    [debouncedSave]
  );

  const setCurrentSlide = useCallback(
    (index: number) => {
      setState((prev) => {
        const clampedIndex = Math.max(
          0,
          Math.min(index, prev.slides.length - 1)
        );
        const newState = { ...prev, currentSlide: clampedIndex };
        debouncedSave(newState);
        return newState;
      });
    },
    [debouncedSave]
  );

  const setTheme = useCallback(
    (theme: SlidesState["theme"]) => {
      updateState({ theme });
    },
    [updateState]
  );

  const setTitle = useCallback(
    (title: string) => {
      updateState({ title });
    },
    [updateState]
  );

  // Set all slides at once (for AI generation)
  const setSlides = useCallback(
    (slides: Slide[], title?: string, theme?: SlidesState["theme"]) => {
      setState((prev) => {
        const newState: SlidesState = {
          ...prev,
          slides,
          currentSlide: 0,
          ...(title && { title }),
          ...(theme && { theme }),
        };
        debouncedSave(newState);
        return newState;
      });
    },
    [debouncedSave]
  );

  // Start presenting - broadcast to all users
  const startPresenting = useCallback(async () => {
    if (!roomId || !user) return;
    
    try {
      await supabase
        .from("room_slides")
        .update({
          presenting_user_id: user.id,
          presenting_started_at: new Date().toISOString(),
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("room_id", roomId);
        
      setState(prev => ({
        ...prev,
        presentingUserId: user.id,
        presentingStartedAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.error("Error starting presentation:", err);
    }
  }, [roomId, user]);

  // Stop presenting
  const stopPresenting = useCallback(async () => {
    if (!roomId || !user) return;
    
    try {
      await supabase
        .from("room_slides")
        .update({
          presenting_user_id: null,
          presenting_started_at: null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("room_id", roomId);
        
      setState(prev => ({
        ...prev,
        presentingUserId: null,
        presentingStartedAt: null,
      }));
    } catch (err) {
      console.error("Error stopping presentation:", err);
    }
  }, [roomId, user]);

  // Check if current user is the presenter
  const isPresenter = state.presentingUserId === user?.id;
  const isAudienceMember = state.presentingUserId !== null && state.presentingUserId !== user?.id;

  // Load on mount
  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`slides-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_slides",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const data = payload.new as {
            slides: unknown;
            current_slide: number;
            theme: string;
            title: string;
            updated_by: string;
            presenting_user_id: string | null;
            presenting_started_at: string | null;
          };
          const updatedBy = data.updated_by;
          
          // Always sync presenter state from other users
          // Only sync content if change was made by another user
          if (updatedBy !== user?.id) {
            isSyncing.current = true;
            
            // Auto-open slides app when someone else starts presenting
            const wasPresenting = state.presentingUserId;
            const nowPresenting = data.presenting_user_id;
            if (!wasPresenting && nowPresenting && nowPresenting !== user?.id) {
              console.log("Someone started presenting, opening slides app");
              emitOpenApp("slides");
            }
            
            setState({
              slides: Array.isArray(data.slides)
                ? (data.slides as Slide[])
                : [],
              currentSlide: data.current_slide ?? 0,
              theme: (data.theme as SlidesState["theme"]) ?? "dark",
              title: data.title ?? "Untitled Presentation",
              presentingUserId: data.presenting_user_id,
              presentingStartedAt: data.presenting_started_at,
            });
            isSyncing.current = false;
          } else {
            // Still update presenter state even if we made the change (for confirmation)
            setState(prev => ({
              ...prev,
              presentingUserId: data.presenting_user_id,
              presentingStartedAt: data.presenting_started_at,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    ...state,
    isLoading,
    isSaving,
    isPresenter,
    isAudienceMember,
    addSlide,
    updateSlide,
    deleteSlide,
    reorderSlides,
    setCurrentSlide,
    setTheme,
    setTitle,
    setSlides,
    startPresenting,
    stopPresenting,
  };
}
