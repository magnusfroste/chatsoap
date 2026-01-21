import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Plus, Search, Loader2, Sparkles } from "lucide-react";
import { Note } from "@/hooks/useNotes";
import { CAGNote } from "@/hooks/useCAGContext";
import { format } from "date-fns";

interface NotesAppProps {
  notes: Note[];
  isLoading: boolean;
  onNoteSelect: (note: Note) => void;
  onCreateNote: () => void;
  // CAG context props
  selectedCAGNotes?: CAGNote[];
  onToggleCAGNote?: (note: CAGNote) => void;
  isNoteInCAG?: (noteId: string) => boolean;
}

const NotesApp = ({ 
  notes, 
  isLoading, 
  onNoteSelect, 
  onCreateNote,
  selectedCAGNotes = [],
  onToggleCAGNote,
  isNoteInCAG,
}: NotesAppProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const truncateContent = (content: string, maxLength = 120) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
  };

  const toCAGNote = (note: Note): CAGNote => ({
    id: note.id,
    title: note.title,
    content: note.content,
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Notes</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {notes.length}
            </span>
            {selectedCAGNotes.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {selectedCAGNotes.length} in context
              </span>
            )}
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={onCreateNote}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
        
        {/* Search */}
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

      {/* Notes Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery ? "No matching notes" : "No notes yet"}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[250px]">
                {searchQuery 
                  ? "Try a different search term" 
                  : "Create a note to capture ideas, save messages, or collaborate"}
              </p>
              {!searchQuery && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onCreateNote}
                  className="mt-4 gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Create Note
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredNotes.map((note) => {
                const isInCAG = isNoteInCAG?.(note.id) ?? false;
                
                return (
                  <div
                    key={note.id}
                    className={`relative text-left p-4 rounded-xl border bg-card hover:bg-muted/50 active:scale-[0.98] transition-all group ${
                      isInCAG 
                        ? "border-primary/50 ring-1 ring-primary/20" 
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    {/* CAG Toggle */}
                    {onToggleCAGNote && (
                      <div 
                        className="absolute top-3 left-3 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div 
                          className={`flex items-center justify-center w-6 h-6 rounded-md transition-all cursor-pointer ${
                            isInCAG 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-background/80 backdrop-blur-sm border border-border opacity-0 group-hover:opacity-100"
                          }`}
                          onClick={() => onToggleCAGNote(toCAGNote(note))}
                        >
                          {isInCAG ? (
                            <Sparkles className="w-3.5 h-3.5" />
                          ) : (
                            <Checkbox 
                              checked={false}
                              className="w-4 h-4 border-muted-foreground/50"
                            />
                          )}
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={() => onNoteSelect(note)}
                      className="w-full text-left"
                    >
                      <h3 className={`font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors ${onToggleCAGNote ? 'pl-8' : ''}`}>
                        {note.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                        {truncateContent(note.content)}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-3 uppercase tracking-wide">
                        {format(new Date(note.updated_at), "MMM d, yyyy · HH:mm")}
                      </p>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NotesApp;
