// Canvas Apps Module
// Provides a modular, registry-based system for canvas mini-applications

export { canvasAppRegistry } from "./registry";
export type { 
  CanvasAppId 
} from "./registry";
export type { 
  CanvasAppDefinition, 
  CanvasAppProps, 
  CanvasAppBaseProps,
  CanvasAppWithCAGProps,
  CanvasAppCallbacks,
  CanvasAppBadge,
  CanvasAppBadgeFunction,
  CanvasAppRegistry,
} from "./types";
export { 
  canvasEventBus, 
  emitBrowserNavigate, 
  emitOpenApp,
  emitCreateNote,
} from "./events";
