# Memory: features/notes-per-conversation
Updated: 2026-01-31

## Notes Scoping

Notes are scoped to individual conversations via `conversation_id`:
- Each note belongs to exactly one conversation
- Notes only appear in the FileManager of that specific conversation
- Creating a note in conversation A will NOT show it in conversation B

## Query Pattern

```typescript
// FileManagerApp fetches notes for current conversation only
supabase
  .from("notes")
  .select("*")
  .eq("conversation_id", conversationId)
```

## RLS Policies

- SELECT/UPDATE: Owner OR conversation member (if conversation_id is set)
- INSERT/DELETE: Owner only

## Data Flow

1. User creates note in conversation X
2. Note is saved with `conversation_id = X`
3. Note appears only in Files panel of conversation X
4. Transformation results create new notes in the same conversation
