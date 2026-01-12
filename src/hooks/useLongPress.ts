import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
}

export const useLongPress = ({ onLongPress, onClick, delay = 500 }: UseLongPressOptions) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Prevent context menu on mobile
    e.preventDefault();
    
    isLongPressRef.current = false;
    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback((e: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (shouldTriggerClick && !isLongPressRef.current && onClick) {
      onClick();
    }
  }, [onClick]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onLongPress();
    },
  };
};
