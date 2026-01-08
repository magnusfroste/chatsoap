import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { supabase } from "@/integrations/supabase/client";

export const useCollaborativeCanvas = (roomId: string | undefined, userId: string | undefined) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isSyncing = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Save canvas to database
  const saveCanvas = useCallback(async () => {
    if (!fabricRef.current || !roomId || !userId || isSyncing.current) return;
    
    const canvasData = fabricRef.current.toJSON();
    
    const { data: existing } = await supabase
      .from("room_canvas")
      .select("id")
      .eq("room_id", roomId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("room_canvas")
        .update({
          canvas_data: canvasData,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("room_id", roomId);
    } else {
      await supabase.from("room_canvas").insert({
        room_id: roomId,
        canvas_data: canvasData,
        updated_by: userId,
      });
    }
  }, [roomId, userId]);

  // Debounced save
  const debouncedSave = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      saveCanvas();
    }, 300);
  }, [saveCanvas]);

  // Load canvas from database
  const loadCanvas = useCallback(async () => {
    if (!fabricRef.current || !roomId) return;
    
    const { data } = await supabase
      .from("room_canvas")
      .select("canvas_data")
      .eq("room_id", roomId)
      .maybeSingle();

    if (data?.canvas_data && typeof data.canvas_data === 'object') {
      isSyncing.current = true;
      await fabricRef.current.loadFromJSON(data.canvas_data as Record<string, unknown>);
      fabricRef.current.renderAll();
      isSyncing.current = false;
    }
    
    setIsLoading(false);
  }, [roomId]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !roomId) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 500,
      backgroundColor: "#1a1a2e",
      isDrawingMode: true,
    });

    // Set up drawing brush
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = "#c4a7ff";
      canvas.freeDrawingBrush.width = 2;
    }

    fabricRef.current = canvas;
    
    // Load existing canvas data
    loadCanvas();

    // Set up event listeners for changes
    const handleChange = () => {
      if (!isSyncing.current) {
        debouncedSave();
      }
    };

    canvas.on("object:added", handleChange);
    canvas.on("object:modified", handleChange);
    canvas.on("object:removed", handleChange);
    canvas.on("path:created", handleChange);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [roomId, loadCanvas, debouncedSave]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`canvas-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_canvas",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const updatedBy = (payload.new as { updated_by: string }).updated_by;
          // Only sync if the change was made by another user
          if (updatedBy !== userId && fabricRef.current) {
            const canvasData = (payload.new as { canvas_data: Record<string, unknown> }).canvas_data;
            if (canvasData && typeof canvasData === 'object') {
              isSyncing.current = true;
              await fabricRef.current.loadFromJSON(canvasData);
              fabricRef.current.renderAll();
              isSyncing.current = false;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  const setDrawingMode = useCallback((enabled: boolean) => {
    if (fabricRef.current) {
      fabricRef.current.isDrawingMode = enabled;
    }
  }, []);

  const setBrushColor = useCallback((color: string) => {
    if (fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.color = color;
    }
  }, []);

  const setBrushWidth = useCallback((width: number) => {
    if (fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.width = width;
    }
  }, []);

  const clearCanvas = useCallback(() => {
    if (fabricRef.current) {
      fabricRef.current.clear();
      fabricRef.current.backgroundColor = "#1a1a2e";
      fabricRef.current.renderAll();
      saveCanvas();
    }
  }, [saveCanvas]);

  const deleteSelected = useCallback(() => {
    if (fabricRef.current) {
      const activeObjects = fabricRef.current.getActiveObjects();
      activeObjects.forEach((obj) => {
        fabricRef.current?.remove(obj);
      });
      fabricRef.current.discardActiveObject();
      fabricRef.current.renderAll();
      debouncedSave();
    }
  }, [debouncedSave]);

  return {
    canvasRef,
    isLoading,
    setDrawingMode,
    setBrushColor,
    setBrushWidth,
    clearCanvas,
    deleteSelected,
  };
};
