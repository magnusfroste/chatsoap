import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FileText, Plus, Search, X, Loader2 } from "lucide-react";
import { Note } from "@/hooks/useNotes";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

interface NotesSidebarProps {
  notes: Note[];
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onNoteSelect: (note: Note) => void;
  onCreateNote: () => void;
}

const NotesContent = ({
  notes,
  isLoading,
  searchQuery,
  setSearchQuery,
  onNoteSelect,
  onCreateNote,
  onClose,
  showHeader = true,
}: {
  notes: Note[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onNoteSelect: (note: Note) => void;
  onCreateNote: () => void;
  onClose: () => void;
  showHeader?: boolean;
}) => {
  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const truncateContent = (content: string, maxLength = 60) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
  };

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Notes</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onCreateNote}
              className="h-8 w-8 hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/50 h-9"
          />
        </div>
      </div>

      {/* Notes list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery ? "No matching notes" : "No notes yet"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">
              {searchQuery 
                ? "Try a different search term" 
                : "Save messages from chat or create new notes"}
            </p>
            {!searchQuery && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onCreateNote}
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Note
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => onNoteSelect(note)}
                className="w-full text-left p-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-all group touch-manipulation"
              >
                <h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                  {note.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {truncateContent(note.content)}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-2 uppercase tracking-wide">
                  {format(new Date(note.updated_at), "MMM d, HH:mm")}
                </p>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export const NotesSidebar = ({
  notes,
  isLoading,
  isOpen,
  onClose,
  onNoteSelect,
  onCreateNote,
}: NotesSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();

  // Mobile: Use Sheet
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:w-[400px] p-0">
          <SheetHeader className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Notes
              </SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCreateNote}
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>
          <NotesContent
            notes={notes}
            isLoading={isLoading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onNoteSelect={(note) => {
              onNoteSelect(note);
            }}
            onCreateNote={onCreateNote}
            onClose={onClose}
            showHeader={false}
          />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Regular sidebar
  if (!isOpen) return null;

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full flex-shrink-0 animate-in slide-in-from-right-2 duration-200">
      <NotesContent
        notes={notes}
        isLoading={isLoading}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onNoteSelect={onNoteSelect}
        onCreateNote={onCreateNote}
        onClose={onClose}
        showHeader={true}
      />
    </div>
  );
};
