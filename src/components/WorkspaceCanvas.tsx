import { useState, useEffect, Suspense, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNotes, Note } from "@/hooks/useNotes";
import { useCAGContext, CAGFile, CAGNote } from "@/hooks/useCAGContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { NoteEditor } from "@/components/NoteEditor";
import { canvasAppRegistry, CanvasAppProps } from "@/lib/canvas-apps";

interface WorkspaceCanvasProps {
  conversationId: string | undefined;
  conversationType?: "direct" | "group" | "ai_chat";
  cagContext?: {
    selectedFiles: CAGFile[];
    toggleFile: (file: CAGFile) => void;
    isFileSelected: (fileId: string) => boolean;
    selectedNotes: CAGNote[];
    toggleNote: (note: CAGNote) => void;
    isNoteSelected: (noteId: string) => boolean;
  };
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export type CanvasApp = string;

const STORAGE_KEY = "workspace-canvas-app";

export const WorkspaceCanvas = ({ 
  conversationId, 
  conversationType, 
  cagContext, 
  activeTab, 
  onTabChange 
}: WorkspaceCanvasProps) => {
  const { user } = useAuth();
  const { notes, isLoading: notesLoading, createNote, updateNote, deleteNote } = useNotes(user?.id);
  
  // Internal CAG context if not provided
  const internalCAG = useCAGContext(conversationId);
  const cag = cagContext || {
    selectedFiles: internalCAG.selectedFiles,
    toggleFile: internalCAG.toggleFile,
    isFileSelected: internalCAG.isFileSelected,
    selectedNotes: internalCAG.selectedNotes,
    toggleNote: internalCAG.toggleNote,
    isNoteSelected: internalCAG.isNoteSelected,
  };

  // Get all visible apps from registry
  const visibleApps = canvasAppRegistry.getVisible();

  // Get initial app from localStorage or default to first app
  const [internalActiveApp, setInternalActiveApp] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Validate saved app exists
    if (saved && canvasAppRegistry.get(saved)) {
      return saved;
    }
    return visibleApps[0]?.id || "notes";
  });
  
  // Use external control if provided, otherwise internal
  const activeApp = activeTab ?? internalActiveApp;
  const setActiveApp = useCallback((app: string) => {
    if (onTabChange) {
      onTabChange(app);
    } else {
      setInternalActiveApp(app);
    }
  }, [onTabChange]);
  
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [documentParams, setDocumentParams] = useState<{ url: string; name: string; type: string } | null>(null);

  // Persist active app
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeApp);
  }, [activeApp]);

  // Filter notes for current conversation
  const conversationNotes = notes.filter(
    (note) => note.conversation_id === conversationId || !note.conversation_id
  );

  const handleNoteSelect = (note: Note) => {
    setSelectedNote(note);
    setNoteEditorOpen(true);
  };

  const handleCreateNote = async () => {
    const newNote = await createNote({
      title: "New Note",
      content: "",
      conversationId,
    });
    if (newNote) {
      setSelectedNote(newNote);
      setNoteEditorOpen(true);
    }
  };

  const handleViewDocument = useCallback((url: string, name: string, type: string) => {
    setDocumentParams({ url, name, type });
    setActiveApp("document");
  }, [setActiveApp]);

  const handleOpenApp = useCallback((appId: string, params?: Record<string, unknown>) => {
    if (appId === "document" && params) {
      setDocumentParams(params as { url: string; name: string; type: string });
    }
    setActiveApp(appId);
  }, [setActiveApp]);

  // Empty state when no conversation selected
  if (!conversationId) {
    const EmptyIcon = visibleApps[0]?.icon;
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/20 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          {EmptyIcon && <EmptyIcon className="w-8 h-8 text-muted-foreground/50" />}
        </div>
        <p className="text-sm font-medium">Select a conversation</p>
        <p className="text-xs text-muted-foreground/70 mt-1">to access workspace tools</p>
      </div>
    );
  }

  const LoadingFallback = () => (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  // Get current app definition
  const currentAppDef = canvasAppRegistry.get(activeApp);

  // Build props for the current app
  const buildAppProps = (): CanvasAppProps => {
    const baseProps: CanvasAppProps = {
      conversationId,
      userId: user?.id,
      conversationType,
      openApp: handleOpenApp,
      viewDocument: handleViewDocument,
    };

    // Add CAG props for apps that support it
    const appDef = canvasAppRegistry.get(activeApp);
    if (appDef?.supportsCAG) {
      return {
        ...baseProps,
        selectedCAGFiles: cag.selectedFiles,
        selectedCAGNotes: cag.selectedNotes,
        onToggleCAGFile: cag.toggleFile,
        onToggleCAGNote: cag.toggleNote,
        isFileInCAG: cag.isFileSelected,
        isNoteInCAG: cag.isNoteSelected,
      };
    }

    // Add document params for document viewer
    if (activeApp === "document" && documentParams) {
      return {
        ...baseProps,
        params: documentParams,
      };
    }

    return baseProps;
  };

  // Get all apps including hidden ones that should be shown
  const allApps = canvasAppRegistry.getAll();
  const tabApps = allApps.filter(app => {
    if (!app.hidden) return true;
    // Show document tab only when viewing a document
    if (app.id === "document" && documentParams) return true;
    return false;
  });

  return (
    <div className="h-full flex flex-col bg-background">
      {/* App Switcher - Dynamic tab bar from registry */}
      <div className="flex-shrink-0 border-b border-border bg-card px-2">
        <Tabs value={activeApp} onValueChange={setActiveApp}>
          <TabsList className="h-12 w-full justify-start gap-1 bg-transparent p-0">
            {tabApps.map((app) => {
              const Icon = app.icon;
              const badge = app.getBadge?.({
                selectedCAGFiles: cag.selectedFiles,
                selectedCAGNotes: cag.selectedNotes,
              });
              
              return (
                <TabsTrigger 
                  key={app.id}
                  value={app.id} 
                  className="relative flex items-center gap-2 px-4 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-lg"
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline truncate max-w-[100px]">
                    {app.id === "document" && documentParams ? documentParams.name : app.name}
                  </span>
                  {badge && badge.type === "count" && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground px-1">
                      {badge.value}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* App Content - Render from registry */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<LoadingFallback />}>
          {currentAppDef && (() => {
            const Component = currentAppDef.component as any;
            const props = buildAppProps();
            
            // Special handling for Notes app (needs extra props)
            if (currentAppDef.id === "notes") {
              return (
                <Component
                  {...props}
                  notes={conversationNotes}
                  isLoading={notesLoading}
                  onNoteSelect={handleNoteSelect}
                  onCreateNote={handleCreateNote}
                />
              );
            }
            
            // Special handling for document viewer
            if (currentAppDef.id === "document" && documentParams) {
              return (
                <Component
                  {...props}
                  url={documentParams.url}
                  name={documentParams.name}
                  type={documentParams.type}
                  onClose={() => {
                    setDocumentParams(null);
                    setActiveApp("files");
                  }}
                />
              );
            }
            
            return <Component {...props} />;
          })()}
        </Suspense>
      </div>

      {/* Note Editor Dialog */}
      <NoteEditor
        note={selectedNote}
        isOpen={noteEditorOpen}
        onClose={() => {
          setNoteEditorOpen(false);
          setSelectedNote(null);
        }}
        onSave={async (noteId, updates) => {
          const updated = await updateNote(noteId, updates);
          if (updated) setSelectedNote(updated);
          return updated;
        }}
        onDelete={deleteNote}
      />
    </div>
  );
};

export default WorkspaceCanvas;
