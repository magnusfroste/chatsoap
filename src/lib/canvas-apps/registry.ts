import { lazy } from "react";
import { FileText, PenTool, FolderOpen, FileSearch, Globe, Code2, Presentation } from "lucide-react";
import { CanvasAppDefinition, CanvasAppRegistry } from "./types";

/**
 * Core canvas apps registry
 * Community apps can be added via registry.register()
 */

// Lazy load all canvas app components
const NotesApp = lazy(() => import("@/components/canvas/NotesApp"));
const WhiteboardApp = lazy(() => import("@/components/canvas/WhiteboardApp"));
const FileManagerApp = lazy(() => import("@/components/canvas/FileManagerApp"));
const DocumentViewerApp = lazy(() => import("@/components/canvas/DocumentViewerApp"));
const MiniBrowserApp = lazy(() => import("@/components/canvas/MiniBrowserApp"));
const CodeSandboxApp = lazy(() => import("@/components/canvas/CodeSandboxApp"));
const SlidesApp = lazy(() => import("@/components/canvas/SlidesApp"));

// Core app definitions
const coreApps: CanvasAppDefinition[] = [
  // Notes is now integrated into Files - hidden from tab bar
  {
    id: "notes",
    name: "Notes",
    description: "Create and manage notes for your conversations",
    icon: FileText,
    component: NotesApp as any,
    isCore: true,
    supportsCAG: true,
    hidden: true, // Now integrated into Files
    order: 1,
    getBadge: ({ selectedCAGNotes }) => 
      selectedCAGNotes.length > 0 
        ? { type: "count", value: selectedCAGNotes.length, variant: "primary" }
        : null,
  },
  {
    id: "whiteboard",
    name: "Whiteboard",
    description: "Collaborative drawing and diagramming",
    icon: PenTool,
    component: WhiteboardApp as any,
    isCore: true,
    supportsCAG: false,
    order: 2,
  },
  {
    id: "files",
    name: "Files",
    description: "Browse files and notes in one place",
    icon: FolderOpen,
    component: FileManagerApp as any,
    isCore: true,
    supportsCAG: true,
    order: 1,
    getBadge: ({ selectedCAGFiles, selectedCAGNotes }) => {
      const total = selectedCAGFiles.length + selectedCAGNotes.length;
      return total > 0 
        ? { type: "count", value: total, variant: "primary" }
        : null;
    },
  },
  {
    id: "slides",
    name: "Slides",
    description: "AI-powered presentations",
    icon: Presentation,
    component: SlidesApp as any,
    isCore: true,
    supportsCAG: false,
    order: 3,
  },
  {
    id: "code",
    name: "Code",
    description: "Collaborative JavaScript/TypeScript sandbox",
    icon: Code2,
    component: CodeSandboxApp as any,
    isCore: true,
    supportsCAG: false,
    order: 4,
  },
  {
    id: "browser",
    name: "Browser",
    description: "Browse the web within your workspace",
    icon: Globe,
    component: MiniBrowserApp as any,
    isCore: false,
    supportsCAG: false,
    order: 5,
  },
  {
    id: "document",
    name: "Document",
    description: "View documents and files",
    icon: FileSearch,
    component: DocumentViewerApp as any,
    isCore: true,
    supportsCAG: false,
    hidden: true, // Only shown when a document is being viewed
    order: 99,
  },
];

/**
 * Create the canvas app registry
 */
function createRegistry(): CanvasAppRegistry {
  const apps = new Map<string, CanvasAppDefinition>();

  // Register core apps
  coreApps.forEach((app) => {
    apps.set(app.id, app);
  });

  return {
    apps,
    
    register(app: CanvasAppDefinition) {
      if (apps.has(app.id)) {
        console.warn(`Canvas app "${app.id}" is already registered. Overwriting.`);
      }
      apps.set(app.id, app);
    },

    unregister(appId: string) {
      const app = apps.get(appId);
      if (app?.isCore) {
        console.warn(`Cannot unregister core app "${appId}"`);
        return;
      }
      apps.delete(appId);
    },

    get(appId: string) {
      return apps.get(appId);
    },

    getAll() {
      return Array.from(apps.values()).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    },

    getVisible() {
      return this.getAll().filter((app) => !app.hidden);
    },
  };
}

// Export singleton registry
export const canvasAppRegistry = createRegistry();

// Export for type inference
export type CanvasAppId = typeof coreApps[number]["id"];
