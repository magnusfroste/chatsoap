import { useEffect, useRef, useState, useCallback, RefObject } from "react";
import { Canvas as FabricCanvas, PencilBrush, IText, Rect, Circle, Line, FabricObject, TPointerEvent, TPointerEventInfo } from "fabric";
import { supabase } from "@/integrations/supabase/client";

export interface WhiteboardShape {
  type: "rectangle" | "circle" | "arrow" | "sticky" | "text";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  color?: string;
  endX?: number;
  endY?: number;
}

export type ShapeTool = "none" | "rectangle" | "circle" | "line" | "sticky";

const MAX_HISTORY = 50;

export const useCollaborativeCanvas = (
  roomId: string | undefined, 
  userId: string | undefined,
  containerRef: RefObject<HTMLDivElement>
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isSyncing = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Undo/Redo history
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // Shape tool state
  const [activeShapeTool, setActiveShapeTool] = useState<ShapeTool>("none");
  const shapeToolRef = useRef<ShapeTool>("none");
  const isDrawingShapeRef = useRef(false);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentShapeRef = useRef<FabricObject | null>(null);
  const activeColorRef = useRef("#c4a7ff");

  // Save state to history
  const saveToHistory = useCallback(() => {
    if (!fabricRef.current || isUndoRedoRef.current) return;
    
    const json = JSON.stringify(fabricRef.current.toJSON());
    
    // Remove any future states if we're not at the end
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
    
    // Add new state
    historyRef.current.push(json);
    
    // Limit history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }
    
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  // Undo
  const undo = useCallback(async () => {
    if (!fabricRef.current || historyIndexRef.current <= 0) return;
    
    isUndoRedoRef.current = true;
    historyIndexRef.current--;
    
    const state = historyRef.current[historyIndexRef.current];
    await fabricRef.current.loadFromJSON(JSON.parse(state));
    fabricRef.current.renderAll();
    
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    
    isUndoRedoRef.current = false;
    debouncedSave();
  }, []);

  // Redo
  const redo = useCallback(async () => {
    if (!fabricRef.current || historyIndexRef.current >= historyRef.current.length - 1) return;
    
    isUndoRedoRef.current = true;
    historyIndexRef.current++;
    
    const state = historyRef.current[historyIndexRef.current];
    await fabricRef.current.loadFromJSON(JSON.parse(state));
    fabricRef.current.renderAll();
    
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    
    isUndoRedoRef.current = false;
    debouncedSave();
  }, []);

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
    if (!fabricRef.current || !roomId) {
      setIsLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("room_canvas")
        .select("canvas_data")
        .eq("room_id", roomId)
        .maybeSingle();

      // If there's an error (possibly RLS), just continue with empty canvas
      if (error) {
        console.log("No existing canvas data or RLS error:", error.message);
      }

      if (data?.canvas_data && typeof data.canvas_data === 'object') {
        isSyncing.current = true;
        await fabricRef.current.loadFromJSON(data.canvas_data as Record<string, unknown>);
        fabricRef.current.renderAll();
        isSyncing.current = false;
      }
    } catch (err) {
      console.error("Error loading canvas:", err);
    }
    
    setIsLoading(false);
  }, [roomId]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !roomId || !containerRef.current) return;

    // Get initial dimensions from container
    const rect = containerRef.current.getBoundingClientRect();
    const canvas = new FabricCanvas(canvasRef.current, {
      width: rect.width || 800,
      height: rect.height || 500,
      backgroundColor: "#1a1a2e",
      isDrawingMode: true,
    });

    // Set up drawing brush explicitly for Fabric.js v6
    const brush = new PencilBrush(canvas);
    brush.color = "#c4a7ff";
    brush.width = 2;
    canvas.freeDrawingBrush = brush;

    fabricRef.current = canvas;
    
    // Load existing canvas data
    loadCanvas();

    // Set up event listeners for changes
    const handleChange = () => {
      if (!isSyncing.current && !isUndoRedoRef.current) {
        saveToHistory();
        debouncedSave();
      }
    };

    canvas.on("object:added", handleChange);
    canvas.on("object:modified", handleChange);
    canvas.on("object:removed", handleChange);
    canvas.on("path:created", handleChange);
    
    // Shape drawing handlers
    const handleMouseDown = (opt: TPointerEventInfo<TPointerEvent>) => {
      if (shapeToolRef.current === "none") return;
      
      const pointer = canvas.getScenePoint(opt.e);
      isDrawingShapeRef.current = true;
      shapeStartRef.current = { x: pointer.x, y: pointer.y };
      
      const color = activeColorRef.current;
      
      let shape: FabricObject | null = null;
      
      if (shapeToolRef.current === "rectangle") {
        shape = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: "transparent",
          stroke: color,
          strokeWidth: 2,
          rx: 4,
          ry: 4,
          selectable: false,
          evented: false,
        });
      } else if (shapeToolRef.current === "circle") {
        shape = new Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 0,
          fill: "transparent",
          stroke: color,
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
      } else if (shapeToolRef.current === "line") {
        shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: color,
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
      } else if (shapeToolRef.current === "sticky") {
        shape = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: color + "33",
          stroke: color,
          strokeWidth: 1,
          rx: 4,
          ry: 4,
          selectable: false,
          evented: false,
        });
      }
      
      if (shape) {
        currentShapeRef.current = shape;
        canvas.add(shape);
      }
    };
    
    const handleMouseMove = (opt: TPointerEventInfo<TPointerEvent>) => {
      if (!isDrawingShapeRef.current || !shapeStartRef.current || !currentShapeRef.current) return;
      
      const pointer = canvas.getScenePoint(opt.e);
      const startX = shapeStartRef.current.x;
      const startY = shapeStartRef.current.y;
      
      if (shapeToolRef.current === "rectangle") {
        const rect = currentShapeRef.current as Rect;
        const width = Math.abs(pointer.x - startX);
        const height = Math.abs(pointer.y - startY);
        rect.set({
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
          width,
          height,
        });
      } else if (shapeToolRef.current === "circle") {
        const circle = currentShapeRef.current as Circle;
        const radius = Math.sqrt(
          Math.pow(pointer.x - startX, 2) + Math.pow(pointer.y - startY, 2)
        ) / 2;
        circle.set({
          left: (startX + pointer.x) / 2 - radius,
          top: (startY + pointer.y) / 2 - radius,
          radius,
        });
      } else if (shapeToolRef.current === "line") {
        const line = currentShapeRef.current as Line;
        line.set({ x2: pointer.x, y2: pointer.y });
      } else if (shapeToolRef.current === "sticky") {
        const rect = currentShapeRef.current as Rect;
        const width = Math.abs(pointer.x - startX);
        const height = Math.abs(pointer.y - startY);
        rect.set({
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
          width,
          height,
        });
      }
      
      canvas.renderAll();
    };
    
    const handleMouseUp = () => {
      if (!isDrawingShapeRef.current || !currentShapeRef.current) return;
      
      const shape = currentShapeRef.current;
      
      // Make the shape selectable after creation
      shape.set({
        selectable: true,
        evented: true,
      });
      
      // For sticky notes, add editable text inside
      if (shapeToolRef.current === "sticky" && shape instanceof Rect) {
        const rect = shape as Rect;
        const left = rect.left || 0;
        const top = rect.top || 0;
        const width = rect.width || 120;
        const height = rect.height || 80;
        
        // Only add text if the sticky has reasonable size
        if (width > 30 && height > 20) {
          const text = new IText("Click to edit", {
            left: left + 8,
            top: top + 8,
            fontSize: 14,
            fill: "#ffffff",
            fontFamily: "Inter, sans-serif",
            width: width - 16,
          });
          canvas.add(text);
          canvas.setActiveObject(text);
          text.enterEditing();
          text.selectAll();
        }
      }
      
      isDrawingShapeRef.current = false;
      shapeStartRef.current = null;
      currentShapeRef.current = null;
      
      canvas.renderAll();
    };
    
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);
    
    // Save initial state to history
    setTimeout(() => {
      if (fabricRef.current) {
        const json = JSON.stringify(fabricRef.current.toJSON());
        historyRef.current = [json];
        historyIndexRef.current = 0;
        setCanUndo(false);
        setCanRedo(false);
      }
    }, 100);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [roomId, loadCanvas, debouncedSave, containerRef, saveToHistory]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current || !fabricRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (fabricRef.current && width > 0 && height > 0) {
        fabricRef.current.setDimensions({ width, height });
        fabricRef.current.renderAll();
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [containerRef]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're inside a text input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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
      if (enabled) {
        setActiveShapeTool("none");
        shapeToolRef.current = "none";
      }
    }
  }, []);

  const setBrushColor = useCallback((color: string) => {
    activeColorRef.current = color;
    if (fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.color = color;
    }
  }, []);

  const setBrushWidth = useCallback((width: number) => {
    if (fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.width = width;
    }
  }, []);
  
  // Shape tool selection
  const selectShapeTool = useCallback((tool: ShapeTool) => {
    if (!fabricRef.current) return;
    
    setActiveShapeTool(tool);
    shapeToolRef.current = tool;
    
    if (tool !== "none") {
      fabricRef.current.isDrawingMode = false;
      fabricRef.current.selection = false;
      fabricRef.current.defaultCursor = "crosshair";
      fabricRef.current.hoverCursor = "crosshair";
    } else {
      fabricRef.current.selection = true;
      fabricRef.current.defaultCursor = "default";
      fabricRef.current.hoverCursor = "move";
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

  const addText = useCallback((color: string) => {
    if (!fabricRef.current) return;
    
    const text = new IText("Type here...", {
      left: 100,
      top: 100,
      fontSize: 20,
      fill: color,
      fontFamily: "Inter, sans-serif",
    });
    
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    fabricRef.current.renderAll();
  }, []);

  // Add shapes from AI
  const addShapes = useCallback((shapes: WhiteboardShape[]) => {
    if (!fabricRef.current) return;
    
    const objectsToAdd: FabricObject[] = [];
    
    for (const shape of shapes) {
      const color = shape.color || "#c4a7ff";
      
      switch (shape.type) {
        case "rectangle":
          objectsToAdd.push(new Rect({
            left: shape.x,
            top: shape.y,
            width: shape.width || 100,
            height: shape.height || 60,
            fill: "transparent",
            stroke: color,
            strokeWidth: 2,
            rx: 4,
            ry: 4,
          }));
          break;
          
        case "circle":
          objectsToAdd.push(new Circle({
            left: shape.x,
            top: shape.y,
            radius: shape.radius || 40,
            fill: "transparent",
            stroke: color,
            strokeWidth: 2,
          }));
          break;
          
        case "arrow":
          const endX = shape.endX || shape.x + 100;
          const endY = shape.endY || shape.y;
          
          // Main line
          objectsToAdd.push(new Line([shape.x, shape.y, endX, endY], {
            stroke: color,
            strokeWidth: 2,
          }));
          
          // Arrow head
          const angle = Math.atan2(endY - shape.y, endX - shape.x);
          const headLength = 12;
          const headAngle = Math.PI / 6;
          
          objectsToAdd.push(new Line([
            endX,
            endY,
            endX - headLength * Math.cos(angle - headAngle),
            endY - headLength * Math.sin(angle - headAngle),
          ], {
            stroke: color,
            strokeWidth: 2,
          }));
          
          objectsToAdd.push(new Line([
            endX,
            endY,
            endX - headLength * Math.cos(angle + headAngle),
            endY - headLength * Math.sin(angle + headAngle),
          ], {
            stroke: color,
            strokeWidth: 2,
          }));
          break;
          
        case "sticky":
          // Background rectangle
          objectsToAdd.push(new Rect({
            left: shape.x,
            top: shape.y,
            width: shape.width || 120,
            height: shape.height || 80,
            fill: color + "33", // 20% opacity
            stroke: color,
            strokeWidth: 1,
            rx: 4,
            ry: 4,
          }));
          
          // Text on sticky
          if (shape.text) {
            objectsToAdd.push(new IText(shape.text, {
              left: shape.x + 8,
              top: shape.y + 8,
              fontSize: 14,
              fill: "#ffffff",
              fontFamily: "Inter, sans-serif",
              width: (shape.width || 120) - 16,
            }));
          }
          break;
          
        case "text":
          objectsToAdd.push(new IText(shape.text || "Text", {
            left: shape.x,
            top: shape.y,
            fontSize: 18,
            fill: color,
            fontFamily: "Inter, sans-serif",
          }));
          break;
      }
    }
    
    // Add all objects
    for (const obj of objectsToAdd) {
      fabricRef.current.add(obj);
    }
    
    fabricRef.current.renderAll();
    saveToHistory();
    debouncedSave();
  }, [saveToHistory, debouncedSave]);

  return {
    canvasRef,
    isLoading,
    setDrawingMode,
    setBrushColor,
    setBrushWidth,
    clearCanvas,
    deleteSelected,
    addText,
    addShapes,
    undo,
    redo,
    canUndo,
    canRedo,
    activeShapeTool,
    selectShapeTool,
  };
};
