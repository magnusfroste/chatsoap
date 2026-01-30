-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;

-- Create new SELECT policy that allows:
-- 1. Owner can always view their notes
-- 2. Conversation members can view notes linked to their conversations
CREATE POLICY "Users can view notes they have access to"
ON public.notes
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (
    conversation_id IS NOT NULL 
    AND is_conversation_member(conversation_id, auth.uid())
  )
);

-- Also update UPDATE policy so conversation members can edit shared notes
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;

CREATE POLICY "Users can update notes they have access to"
ON public.notes
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR (
    conversation_id IS NOT NULL 
    AND is_conversation_member(conversation_id, auth.uid())
  )
);