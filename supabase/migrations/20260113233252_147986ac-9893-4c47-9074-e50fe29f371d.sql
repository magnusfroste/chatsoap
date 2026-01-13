-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Users can view conversations they are members of" ON public.conversations;

-- Create a new SELECT policy using the security definer function
CREATE POLICY "Users can view conversations they are members of" 
ON public.conversations 
FOR SELECT 
USING (
  id IN (SELECT public.get_user_conversation_ids(auth.uid()))
  OR created_by = auth.uid()
);