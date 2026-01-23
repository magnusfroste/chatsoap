import { useState, useEffect, useCallback } from "react";
import { useSlides, Slide, SlidesState } from "@/hooks/useSlides";
import { canvasEventBus } from "@/lib/canvas-apps/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Palette,
  Play,
  Loader2,
  FileText,
  Maximize2,
  X,
  Edit3,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SlidesAppProps {
  conversationId: string;
  userId?: string;
}

const themeStyles: Record<SlidesState["theme"], { bg: string; text: string; accent: string }> = {
  dark: {
    bg: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
    text: "text-white",
    accent: "text-violet-400",
  },
  light: {
    bg: "bg-gradient-to-br from-white via-slate-50 to-white",
    text: "text-slate-900",
    accent: "text-violet-600",
  },
  minimal: {
    bg: "bg-slate-950",
    text: "text-slate-100",
    accent: "text-emerald-400",
  },
  bold: {
    bg: "bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600",
    text: "text-white",
    accent: "text-yellow-300",
  },
};

const layoutLabels: Record<Slide["layout"], string> = {
  title: "Title Only",
  "title-content": "Title + Content",
  "two-column": "Two Columns",
  bullets: "Bullet Points",
  quote: "Quote",
};

function SlidePreview({
  slide,
  theme,
  isActive,
  onClick,
  index,
}: {
  slide: Slide;
  theme: SlidesState["theme"];
  isActive: boolean;
  onClick: () => void;
  index: number;
}) {
  const styles = themeStyles[theme];
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full aspect-video rounded-lg overflow-hidden border-2 transition-all hover:scale-105",
        styles.bg,
        isActive ? "border-primary ring-2 ring-primary/50" : "border-border/50"
      )}
    >
      <div className={cn("p-2 h-full flex flex-col", styles.text)}>
        <div className="text-[8px] font-bold truncate opacity-60">
          {index + 1}. {slide.title || "Untitled"}
        </div>
        <div className="text-[6px] opacity-40 line-clamp-2 mt-0.5">
          {slide.content?.slice(0, 50)}
        </div>
      </div>
    </button>
  );
}

function SlideEditor({
  slide,
  theme,
  onUpdate,
}: {
  slide: Slide;
  theme: SlidesState["theme"];
  onUpdate: (updates: Partial<Slide>) => void;
}) {
  const styles = themeStyles[theme];
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className={cn("w-full h-full rounded-xl p-8", styles.bg, styles.text)}>
        <div className="flex justify-end mb-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsEditing(false)}
          >
            <Check className="w-4 h-4 mr-1" /> Done
          </Button>
        </div>
        <Input
          value={slide.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Slide title..."
          className="text-2xl font-bold bg-transparent border-b border-border/30 rounded-none mb-4"
        />
        <Textarea
          value={slide.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Slide content... (use - for bullets)"
          className="flex-1 bg-transparent border-border/30 min-h-[200px] resize-none"
        />
        <Input
          value={slide.notes || ""}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Speaker notes (only visible in presenter mode)..."
          className="mt-4 text-sm bg-transparent border-border/30 opacity-60"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full h-full rounded-xl overflow-hidden cursor-pointer group relative",
        styles.bg,
        styles.text
      )}
      onClick={() => setIsEditing(true)}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 flex items-center justify-center">
        <div className="flex items-center gap-2 text-white bg-black/50 px-4 py-2 rounded-full">
          <Edit3 className="w-4 h-4" /> Click to edit
        </div>
      </div>
      
      <div className="p-8 h-full flex flex-col justify-center">
        {slide.layout === "title" && (
          <h1 className="text-4xl font-bold text-center">{slide.title || "Untitled Slide"}</h1>
        )}
        
        {slide.layout === "title-content" && (
          <>
            <h2 className={cn("text-3xl font-bold mb-6", styles.accent)}>
              {slide.title || "Untitled Slide"}
            </h2>
            <div className="text-lg leading-relaxed whitespace-pre-wrap">
              {slide.content?.split("\n").map((line, i) => (
                <p key={i} className={line.startsWith("-") ? "pl-4 before:content-['•'] before:mr-2" : ""}>
                  {line.startsWith("-") ? line.slice(1).trim() : line}
                </p>
              ))}
            </div>
          </>
        )}
        
        {slide.layout === "bullets" && (
          <>
            <h2 className={cn("text-2xl font-bold mb-4", styles.accent)}>
              {slide.title}
            </h2>
            <ul className="space-y-3">
              {slide.content?.split("\n").filter(Boolean).map((line, i) => (
                <li key={i} className="flex items-start gap-3 text-lg">
                  <span className={cn("mt-1.5 w-2 h-2 rounded-full", styles.accent.replace("text-", "bg-"))} />
                  {line.replace(/^-\s*/, "")}
                </li>
              ))}
            </ul>
          </>
        )}
        
        {slide.layout === "quote" && (
          <blockquote className="text-2xl italic text-center px-8">
            "{slide.content}"
            {slide.title && (
              <footer className={cn("mt-4 text-lg not-italic", styles.accent)}>
                — {slide.title}
              </footer>
            )}
          </blockquote>
        )}
        
        {slide.layout === "two-column" && (
          <>
            <h2 className={cn("text-2xl font-bold mb-4", styles.accent)}>
              {slide.title}
            </h2>
            <div className="grid grid-cols-2 gap-8">
              {slide.content?.split("\n\n").map((col, i) => (
                <div key={i} className="text-base leading-relaxed">
                  {col.split("\n").map((line, j) => (
                    <p key={j} className="mb-2">{line}</p>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PresenterMode({
  slides,
  currentSlide,
  theme,
  onNavigate,
  onClose,
}: {
  slides: Slide[];
  currentSlide: number;
  theme: SlidesState["theme"];
  onNavigate: (index: number) => void;
  onClose: () => void;
}) {
  const slide = slides[currentSlide];
  const styles = themeStyles[theme];
  const nextSlide = slides[currentSlide + 1];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        onNavigate(Math.min(currentSlide + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft") {
        onNavigate(Math.max(currentSlide - 1, 0));
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentSlide, slides.length, onNavigate, onClose]);

  if (!slide) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className={cn("flex-1", styles.bg, styles.text)}>
        <div className="h-full flex items-center justify-center p-12">
          <div className="max-w-5xl w-full">
            {slide.layout === "title" && (
              <h1 className="text-6xl font-bold text-center">{slide.title}</h1>
            )}
            {slide.layout !== "title" && (
              <>
                <h2 className={cn("text-5xl font-bold mb-8", styles.accent)}>
                  {slide.title}
                </h2>
                <div className="text-2xl leading-relaxed whitespace-pre-wrap">
                  {slide.content?.split("\n").map((line, i) => (
                    <p key={i} className={cn("mb-3", line.startsWith("-") && "pl-6 before:content-['•'] before:mr-3")}>
                      {line.startsWith("-") ? line.slice(1).trim() : line}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Presenter controls */}
      <div className="bg-slate-900 border-t border-slate-700 p-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate(currentSlide - 1)}
              disabled={currentSlide === 0}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-white font-medium">
              {currentSlide + 1} / {slides.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate(currentSlide + 1)}
              disabled={currentSlide === slides.length - 1}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Speaker notes */}
          {slide.notes && (
            <div className="flex-1 mx-8 text-slate-300 text-sm max-h-12 overflow-y-auto">
              <span className="text-slate-500">Notes: </span>
              {slide.notes}
            </div>
          )}

          {/* Next slide preview */}
          {nextSlide && (
            <div className="w-32">
              <div className="text-xs text-slate-500 mb-1">Next:</div>
              <div className={cn("aspect-video rounded text-[6px] p-1", styles.bg, styles.text)}>
                {nextSlide.title}
              </div>
            </div>
          )}

          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SlidesApp({ conversationId, userId }: SlidesAppProps) {
  const {
    slides,
    currentSlide,
    theme,
    title,
    isLoading,
    isSaving,
    addSlide,
    updateSlide,
    deleteSlide,
    setCurrentSlide,
    setTheme,
    setTitle,
    setSlides,
  } = useSlides(conversationId);

  const [isPresenting, setIsPresenting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Listen for slides:update events from AI
  useEffect(() => {
    const unsubscribe = canvasEventBus.on("slides:update", (payload) => {
      setSlides(
        payload.slides as Slide[],
        payload.title,
        payload.theme as SlidesState["theme"]
      );
    });
    return unsubscribe;
  }, [setSlides]);

  const handleAddSlide = useCallback(() => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      title: "New Slide",
      content: "",
      layout: "title-content",
    };
    addSlide(newSlide, currentSlide + 1);
    setCurrentSlide(currentSlide + 1);
  }, [addSlide, currentSlide, setCurrentSlide]);

  const handleDeleteSlide = useCallback(() => {
    if (slides.length > 0) {
      deleteSlide(slides[currentSlide].id);
    }
  }, [deleteSlide, slides, currentSlide]);

  const currentSlideData = slides[currentSlide];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isPresenting && slides.length > 0) {
    return (
      <PresenterMode
        slides={slides}
        currentSlide={currentSlide}
        theme={theme}
        onNavigate={setCurrentSlide}
        onClose={() => setIsPresenting(false)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditingTitle(false)}
              className="w-48 h-8 text-sm"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              {title}
            </button>
          )}
          {isSaving && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Palette className="w-4 h-4 mr-1" />
                Theme
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                🌙 Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                ☀️ Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("minimal")}>
                ⬛ Minimal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("bold")}>
                🎨 Bold
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddSlide}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Slide
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setIsPresenting(true)}
            disabled={slides.length === 0}
          >
            <Play className="w-4 h-4 mr-1" /> Present
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Slide thumbnails */}
        <div className="w-24 border-r border-border/50 bg-muted/20">
          <ScrollArea className="h-full p-2">
            <div className="space-y-2">
              {slides.map((slide, index) => (
                <SlidePreview
                  key={slide.id}
                  slide={slide}
                  theme={theme}
                  isActive={index === currentSlide}
                  onClick={() => setCurrentSlide(index)}
                  index={index}
                />
              ))}
              {slides.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Ask AI to create a presentation
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main slide area */}
        <div className="flex-1 p-6 flex flex-col">
          {currentSlideData ? (
            <>
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full max-w-4xl aspect-video">
                  <SlideEditor
                    slide={currentSlideData}
                    theme={theme}
                    onUpdate={(updates) => updateSlide(currentSlideData.id, updates)}
                  />
                </div>
              </div>

              {/* Bottom controls */}
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentSlide(currentSlide - 1)}
                    disabled={currentSlide === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                    {currentSlide + 1} / {slides.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentSlide(currentSlide + 1)}
                    disabled={currentSlide === slides.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        Layout: {layoutLabels[currentSlideData.layout]}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {Object.entries(layoutLabels).map(([value, label]) => (
                        <DropdownMenuItem
                          key={value}
                          onClick={() =>
                            updateSlide(currentSlideData.id, {
                              layout: value as Slide["layout"],
                            })
                          }
                        >
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteSlide}
                    disabled={slides.length === 0}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPresenting(true)}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">No slides yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ask AI to create a presentation, or add a slide manually
                </p>
                <Button onClick={handleAddSlide}>
                  <Plus className="w-4 h-4 mr-2" /> Add First Slide
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
