import { ComponentType, LazyExoticComponent } from "react";
import { LucideIcon } from "lucide-react";
import { CAGFile, CAGNote } from "@/hooks/useCAGContext";

/**
 * Base props that all canvas apps receive
 */
export interface CanvasAppBaseProps {
  /** Current conversation ID */
  conversationId: string;
  /** Current user ID */
  userId?: string;
  /** Conversation type */
  conversationType?: "direct" | "group" | "ai_chat";
}

/**
 * Extended props for apps that support CAG (Context-Aware Generation)
 */
export interface CanvasAppWithCAGProps extends CanvasAppBaseProps {
  /** Files selected for AI context */
  selectedCAGFiles?: CAGFile[];
  /** Notes selected for AI context */
  selectedCAGNotes?: CAGNote[];
  /** Toggle file in CAG context */
  onToggleCAGFile?: (file: CAGFile) => void;
  /** Toggle note in CAG context */
  onToggleCAGNote?: (note: CAGNote) => void;
  /** Check if file is in CAG */
  isFileInCAG?: (fileId: string) => boolean;
  /** Check if note is in CAG */
  isNoteInCAG?: (noteId: string) => boolean;
}

/**
 * Callback for inter-app communication
 */
export interface CanvasAppCallbacks {
  /** Open a specific app */
  openApp?: (appId: string, params?: Record<string, unknown>) => void;
  /** Send data to chat */
  sendToChat?: (content: string) => void;
  /** Show a document in the document viewer */
  viewDocument?: (url: string, name: string, type: string) => void;
}

/**
 * Full props passed to canvas app components
 */
export interface CanvasAppProps extends CanvasAppWithCAGProps, CanvasAppCallbacks {
  /** Optional parameters passed when opening the app */
  params?: Record<string, unknown>;
}

/**
 * Badge configuration for showing counts/status on app tabs
 */
export interface CanvasAppBadge {
  /** Badge type */
  type: "count" | "dot" | "text";
  /** Value to display (count number or text) */
  value?: number | string;
  /** Badge variant */
  variant?: "default" | "primary" | "warning" | "error";
}

/**
 * Function to compute badge dynamically
 */
export type CanvasAppBadgeFunction = (props: {
  selectedCAGFiles: CAGFile[];
  selectedCAGNotes: CAGNote[];
}) => CanvasAppBadge | null;

/**
 * Canvas app registration metadata
 */
export interface CanvasAppDefinition {
  /** Unique identifier for the app */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description?: string;
  /** Icon component */
  icon: LucideIcon;
  /** Lazy-loaded component */
  component: LazyExoticComponent<ComponentType<CanvasAppProps>>;
  /** Whether this is a core/built-in app */
  isCore?: boolean;
  /** Whether the app supports CAG context */
  supportsCAG?: boolean;
  /** Dynamic badge function */
  getBadge?: CanvasAppBadgeFunction;
  /** Default parameters when opening */
  defaultParams?: Record<string, unknown>;
  /** Whether the app should be hidden from the tab bar (like document viewer) */
  hidden?: boolean;
  /** Order in the tab bar (lower = left) */
  order?: number;
}

/**
 * Registry of all canvas apps
 */
export interface CanvasAppRegistry {
  apps: Map<string, CanvasAppDefinition>;
  register: (app: CanvasAppDefinition) => void;
  unregister: (appId: string) => void;
  get: (appId: string) => CanvasAppDefinition | undefined;
  getAll: () => CanvasAppDefinition[];
  getVisible: () => CanvasAppDefinition[];
}
