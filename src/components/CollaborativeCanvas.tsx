import { useState, useRef, useEffect } from "react";
import { useCollaborativeCanvas, WhiteboardShape, ShapeTool } from "@/hooks/useCollaborativeCanvas";
import { Button } from "@/components/ui/button";
import { 
  Pencil, 
  MousePointer, 
  Trash2, 
  Eraser,
  Loader2,
  Type,
  Undo2,
  Redo2,
  Square,
  Circle,
  Minus,
  StickyNote,
  MoveUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canvasEventBus } from "@/lib/canvas-apps/events";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CollaborativeCanvasProps {
  roomId: string;
  userId: string;
}

const COLORS = [
  "#c4a7ff", // primary purple
  "#ffffff", // white
  "#ff6b6b", // red
  "#4ecdc4", // teal
  "#ffd93d", // yellow
  "#6bcb77", // green
  "#4a9eff", // blue
  "#ff9f43", // orange
];

const BRUSH_SIZES = [2, 4, 8, 12];

type ActiveTool = "draw" | "select" | "rectangle" | "circle" | "line" | "arrow" | "sticky";

export const CollaborativeCanvas = ({ roomId, userId }: CollaborativeCanvasProps) => {
  const [activeTool, setActiveTool] = useState<ActiveTool>("draw");
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [activeSize, setActiveSize] = useState(BRUSH_SIZES[0]);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
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
    selectShapeTool,
  } = useCollaborativeCanvas(roomId, userId, containerRef);

  // Listen for AI-generated shapes
  useEffect(() => {
    const unsubscribe = canvasEventBus.on("whiteboard:shapes", (payload) => {
      if (payload.shapes && payload.shapes.length > 0) {
        addShapes(payload.shapes as WhiteboardShape[]);
      }
    });

    return () => unsubscribe();
  }, [addShapes]);

  const handleToolChange = (tool: ActiveTool) => {
    setActiveTool(tool);
    
    if (tool === "draw") {
      setDrawingMode(true);
      selectShapeTool("none");
    } else if (tool === "select") {
      setDrawingMode(false);
      selectShapeTool("none");
    } else {
      setDrawingMode(false);
      selectShapeTool(tool as ShapeTool);
    }
  };

  const handleAddText = () => {
    setActiveTool("select");
    setDrawingMode(false);
    selectShapeTool("none");
    addText(activeColor);
  };

  const handleColorChange = (color: string) => {
    setActiveColor(color);
    setBrushColor(color);
  };

  const handleSizeChange = (size: number) => {
    setActiveSize(size);
    setBrushWidth(size);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border/50 bg-card/50 flex-wrap">
        {/* Tools */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  activeTool === "draw" && "bg-primary/20 text-primary"
                )}
                onClick={() => handleToolChange("draw")}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Draw</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  activeTool === "select" && "bg-primary/20 text-primary"
                )}
                onClick={() => handleToolChange("select")}
              >
                <MousePointer className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Select</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleAddText}
              >
                <Type className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add text</TooltipContent>
          </Tooltip>
        </div>

        <div className="w-px h-6 bg-border/50" />

        {/* Shape Tools */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  activeTool === "rectangle" && "bg-primary/20 text-primary"
                )}
                onClick={() => handleToolChange("rectangle")}
              >
                <Square className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rectangle</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  activeTool === "circle" && "bg-primary/20 text-primary"
                )}
                onClick={() => handleToolChange("circle")}
              >
                <Circle className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Circle</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  activeTool === "line" && "bg-primary/20 text-primary"
                )}
                onClick={() => handleToolChange("line")}
              >
                <Minus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Line</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  activeTool === "arrow" && "bg-primary/20 text-primary"
                )}
                onClick={() => handleToolChange("arrow")}
              >
                <MoveUpRight className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Arrow</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  activeTool === "sticky" && "bg-primary/20 text-primary"
                )}
                onClick={() => handleToolChange("sticky")}
              >
                <StickyNote className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sticky note</TooltipContent>
          </Tooltip>
        </div>

        <div className="w-px h-6 bg-border/50" />

        {/* Colors */}
        <div className="flex items-center gap-1">
          {COLORS.map((color) => (
            <button
              key={color}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                activeColor === color ? "border-white scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
              onClick={() => handleColorChange(color)}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-border/50" />

        {/* Brush sizes */}
        <div className="flex items-center gap-1">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded transition-colors",
                activeSize === size ? "bg-primary/20" : "hover:bg-muted"
              )}
              onClick={() => handleSizeChange(size)}
            >
              <div 
                className="rounded-full bg-foreground"
                style={{ width: size + 4, height: size + 4 }}
              />
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border/50" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-border/50" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={deleteSelected}
            title="Delete selected"
          >
            <Eraser className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={clearCanvas}
            title="Clear canvas"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full h-full overflow-hidden bg-[#1a1a2e]"
      >
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};
