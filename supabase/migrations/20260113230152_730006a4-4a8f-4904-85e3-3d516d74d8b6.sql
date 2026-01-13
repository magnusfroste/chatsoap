-- Drop the broken policy
DROP POLICY IF EXISTS "Users can view conversations they are members of" ON public.conversations;

-- Create the corrected policy
CREATE POLICY "Users can view conversations they are members of"
ON public.conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM conversation_members
    WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
  )
);