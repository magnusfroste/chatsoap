/**
 * Canvas App Event Bus
 * Enables communication between chat and canvas apps
 */

type BrowserNavigatePayload = {
  url: string;
};

type CodeSandboxPayload = {
  code: string;
  language: "javascript" | "typescript";
  autoRun?: boolean;
};

type CanvasEventPayload = {
  "browser:navigate": BrowserNavigatePayload;
  "code:send": CodeSandboxPayload;
  "app:open": { appId: string; params?: Record<string, unknown> };
};

type CanvasEventType = keyof CanvasEventPayload;

type CanvasEventCallback<T extends CanvasEventType> = (payload: CanvasEventPayload[T]) => void;

interface EventBus {
  on<T extends CanvasEventType>(event: T, callback: CanvasEventCallback<T>): () => void;
  emit<T extends CanvasEventType>(event: T, payload: CanvasEventPayload[T]): void;
  off<T extends CanvasEventType>(event: T, callback: CanvasEventCallback<T>): void;
}

function createEventBus(): EventBus {
  const listeners = new Map<CanvasEventType, Set<CanvasEventCallback<any>>>();

  return {
    on<T extends CanvasEventType>(event: T, callback: CanvasEventCallback<T>) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(callback);
      
      // Return unsubscribe function
      return () => {
        listeners.get(event)?.delete(callback);
      };
    },

    emit<T extends CanvasEventType>(event: T, payload: CanvasEventPayload[T]) {
      const callbacks = listeners.get(event);
      if (callbacks) {
        callbacks.forEach((callback) => callback(payload));
      }
    },

    off<T extends CanvasEventType>(event: T, callback: CanvasEventCallback<T>) {
      listeners.get(event)?.delete(callback);
    },
  };
}

// Singleton event bus for canvas apps
export const canvasEventBus = createEventBus();

// Helper functions for common patterns
export function emitBrowserNavigate(url: string) {
  canvasEventBus.emit("browser:navigate", { url });
}

export function emitOpenApp(appId: string, params?: Record<string, unknown>) {
  canvasEventBus.emit("app:open", { appId, params });
}

export function emitCodeToSandbox(code: string, language: "javascript" | "typescript" = "javascript", autoRun = false) {
  canvasEventBus.emit("code:send", { code, language, autoRun });
}
