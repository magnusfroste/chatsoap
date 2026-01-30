import { cn } from "@/lib/utils";

interface AudioLevelIndicatorProps {
  level: number; // 0-1
  size?: "sm" | "md";
  className?: string;
}

/**
 * Visual audio level indicator with animated bars
 */
export function AudioLevelIndicator({ 
  level, 
  size = "sm",
  className 
}: AudioLevelIndicatorProps) {
  const barCount = size === "sm" ? 4 : 5;
  const barHeight = size === "sm" ? "h-2" : "h-3";
  const barWidth = size === "sm" ? "w-0.5" : "w-1";
  const gap = size === "sm" ? "gap-0.5" : "gap-1";

  return (
    <div className={cn("flex items-end", gap, className)}>
      {Array.from({ length: barCount }).map((_, i) => {
        // Each bar has a threshold - it lights up when level exceeds it
        const threshold = (i + 1) / barCount;
        const isActive = level >= threshold * 0.8; // Slightly lower threshold for sensitivity
        
        // Calculate height based on position and level
        const minHeight = 20 + i * 15; // Progressive minimum heights
        const maxHeight = 100;
        const heightPercent = isActive 
          ? Math.max(minHeight, Math.min(maxHeight, level * 100 + i * 10))
          : minHeight;

        return (
          <div
            key={i}
            className={cn(
              barWidth,
              "rounded-full transition-all duration-75",
              isActive ? "bg-green-500" : "bg-muted-foreground/30"
            )}
            style={{ 
              height: `${heightPercent}%`,
              maxHeight: size === "sm" ? "12px" : "16px",
              minHeight: size === "sm" ? "3px" : "4px",
            }}
          />
        );
      })}
    </div>
  );
}

interface AudioLevelDotsProps {
  level: number;
  className?: string;
}

/**
 * Compact dot-based audio level indicator
 */
export function AudioLevelDots({ level, className }: AudioLevelDotsProps) {
  const dotCount = 3;
  
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: dotCount }).map((_, i) => {
        const threshold = (i + 1) / dotCount;
        const isActive = level >= threshold * 0.6;
        
        return (
          <div
            key={i}
            className={cn(
              "w-1 h-1 rounded-full transition-colors duration-100",
              isActive ? "bg-green-500" : "bg-muted-foreground/30"
            )}
          />
        );
      })}
    </div>
  );
}
