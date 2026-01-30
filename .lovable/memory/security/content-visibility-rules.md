# Memory: security/content-visibility-rules
Updated: 2026-01-30

## Content Visibility in Conversations

### Uploaded Files
- Files uploaded in conversations are **shared** and visible to all participants
- Stored as message attachments with RLS based on conversation membership

### Notes
- Notes created in a chat belong to **both the creator and the chat**
- All conversation members can view and edit notes linked to that conversation
- For **private notes**: Users should create them in an AI assistant chat (where they're the only human member)

### RLS Policies (notes table)
- SELECT: Owner OR conversation member (if conversation_id is set)
- UPDATE: Owner OR conversation member (if conversation_id is set)
- INSERT: Only owner (user_id = auth.uid())
- DELETE: Only owner (user_id = auth.uid())
