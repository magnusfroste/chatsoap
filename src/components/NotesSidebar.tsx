import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Plus, Search, X, Loader2 } from "lucide-react";
import { Note } from "@/hooks/useNotes";
import { format } from "date-fns";

interface NotesSidebarProps {
  notes: Note[];
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onNoteSelect: (note: Note) => void;
  onCreateNote: () => void;
}

export const NotesSidebar = ({
  notes,
  isLoading,
  isOpen,
  onClose,
  onNoteSelect,
  onCreateNote,
}: NotesSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const truncateContent = (content: string, maxLength = 60) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Notes</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCreateNote}
            className="h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/50"
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
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No matching notes" : "No notes yet"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Save messages from chat or create new notes
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => onNoteSelect(note)}
                className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                  {note.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {truncateContent(note.content)}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">
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
