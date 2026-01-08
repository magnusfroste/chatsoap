import { useState } from "react";
import { useCollaborativeCanvas } from "@/hooks/useCollaborativeCanvas";
import { Button } from "@/components/ui/button";
import { 
  Pencil, 
  MousePointer, 
  Trash2, 
  Eraser,
  Loader2,
  Type
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export const CollaborativeCanvas = ({ roomId, userId }: CollaborativeCanvasProps) => {
  const [isDrawing, setIsDrawing] = useState(true);
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [activeSize, setActiveSize] = useState(BRUSH_SIZES[0]);

  const {
    canvasRef,
    isLoading,
    setDrawingMode,
    setBrushColor,
    setBrushWidth,
    clearCanvas,
    deleteSelected,
    addText,
  } = useCollaborativeCanvas(roomId, userId);

  const handleToolChange = (drawing: boolean) => {
    setIsDrawing(drawing);
    setDrawingMode(drawing);
  };

  const handleAddText = () => {
    setIsDrawing(false);
    setDrawingMode(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border/50 bg-card/50 flex-wrap">
        {/* Tools */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8",
              isDrawing && "bg-primary/20 text-primary"
            )}
            onClick={() => handleToolChange(true)}
            title="Draw"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8",
              !isDrawing && "bg-primary/20 text-primary"
            )}
            onClick={() => handleToolChange(false)}
            title="Select"
          >
            <MousePointer className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleAddText}
            title="Add text"
          >
            <Type className="w-4 h-4" />
          </Button>
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
      <div className="flex-1 overflow-auto p-4 bg-background/50">
        <div className="rounded-lg border border-border/50 overflow-hidden shadow-xl inline-block">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
};
