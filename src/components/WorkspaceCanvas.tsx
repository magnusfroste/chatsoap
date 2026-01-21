import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNotes, Note } from "@/hooks/useNotes";
import { useCAGContext, CAGFile } from "@/hooks/useCAGContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, PenTool, FolderOpen, FileSearch, Loader2 } from "lucide-react";
import { NoteEditor } from "@/components/NoteEditor";

// Lazy load canvas apps
const NotesApp = lazy(() => import("@/components/canvas/NotesApp"));
const WhiteboardApp = lazy(() => import("@/components/canvas/WhiteboardApp"));
const FileManagerApp = lazy(() => import("@/components/canvas/FileManagerApp"));
const DocumentViewerApp = lazy(() => import("@/components/canvas/DocumentViewerApp"));

interface WorkspaceCanvasProps {
  conversationId: string | undefined;
  conversationType?: "direct" | "group" | "ai_chat";
  // CAG context - can be passed in or managed internally
  cagContext?: {
    selectedFiles: CAGFile[];
    toggleFile: (file: CAGFile) => void;
    isFileSelected: (fileId: string) => boolean;
  };
}

type CanvasApp = "notes" | "whiteboard" | "files" | "document";

const STORAGE_KEY = "workspace-canvas-app";

export const WorkspaceCanvas = ({ conversationId, conversationType, cagContext }: WorkspaceCanvasProps) => {
  const { user } = useAuth();
  const { notes, isLoading: notesLoading, createNote, updateNote, deleteNote } = useNotes(user?.id);
  
  // Internal CAG context if not provided
  const internalCAG = useCAGContext(conversationId);
  const cag = cagContext || {
    selectedFiles: internalCAG.selectedFiles,
    toggleFile: internalCAG.toggleFile,
    isFileSelected: internalCAG.isFileSelected,
  };
  
  // Get initial app from localStorage or default to "notes"
  const [activeApp, setActiveApp] = useState<CanvasApp>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as CanvasApp) || "notes";
  });
  
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ url: string; name: string; type: string } | null>(null);

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

  const handleViewDocument = (url: string, name: string, type: string) => {
    setSelectedDocument({ url, name, type });
    setActiveApp("document");
  };

  // Empty state when no conversation selected
  if (!conversationId) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/20 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <FolderOpen className="w-8 h-8 text-muted-foreground/50" />
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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* App Switcher - Clean tab bar */}
      <div className="flex-shrink-0 border-b border-border bg-card px-2">
        <Tabs value={activeApp} onValueChange={(v) => setActiveApp(v as CanvasApp)}>
          <TabsList className="h-12 w-full justify-start gap-1 bg-transparent p-0">
            <TabsTrigger 
              value="notes" 
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-lg"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Notes</span>
            </TabsTrigger>
            <TabsTrigger 
              value="whiteboard" 
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-lg"
            >
              <PenTool className="w-4 h-4" />
              <span className="hidden sm:inline">Whiteboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="files" 
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-lg"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Files</span>
            </TabsTrigger>
            {selectedDocument && (
              <TabsTrigger 
                value="document" 
                className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-lg"
              >
                <FileSearch className="w-4 h-4" />
                <span className="hidden sm:inline truncate max-w-[100px]">{selectedDocument.name}</span>
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      {/* App Content */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<LoadingFallback />}>
          {activeApp === "notes" && (
            <NotesApp
              notes={conversationNotes}
              isLoading={notesLoading}
              onNoteSelect={handleNoteSelect}
              onCreateNote={handleCreateNote}
            />
          )}
          {activeApp === "whiteboard" && (
            <WhiteboardApp
              conversationId={conversationId}
              userId={user?.id || ""}
            />
          )}
          {activeApp === "files" && (
            <FileManagerApp
              conversationId={conversationId}
              onViewDocument={handleViewDocument}
              selectedCAGFiles={cag.selectedFiles}
              onToggleCAGFile={cag.toggleFile}
              isFileInCAG={cag.isFileSelected}
            />
          )}
          {activeApp === "document" && selectedDocument && (
            <DocumentViewerApp
              url={selectedDocument.url}
              name={selectedDocument.name}
              type={selectedDocument.type}
              onClose={() => {
                setSelectedDocument(null);
                setActiveApp("files");
              }}
            />
          )}
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
