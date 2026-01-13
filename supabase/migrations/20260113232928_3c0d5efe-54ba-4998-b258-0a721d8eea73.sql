-- Drop existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Conversation creators can add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can leave conversations" ON public.conversation_members;

-- Create new policies that avoid recursion by checking user_id directly

-- Users can view their own membership records
CREATE POLICY "Users can view their own memberships" 
ON public.conversation_members 
FOR SELECT 
USING (user_id = auth.uid());

-- Users can view other members in conversations they belong to (using a subquery that doesn't recurse)
CREATE POLICY "Users can view co-members" 
ON public.conversation_members 
FOR SELECT 
USING (
  conversation_id IN (
    SELECT cm.conversation_id 
    FROM public.conversation_members cm 
    WHERE cm.user_id = auth.uid()
  )
);

-- Conversation creators can add members
CREATE POLICY "Conversation creators can add members" 
ON public.conversation_members 
FOR INSERT 
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )) 
  OR (user_id = auth.uid())
);

-- Members can leave conversations (delete their own membership)
CREATE POLICY "Members can leave conversations" 
ON public.conversation_members 
FOR DELETE 
USING (user_id = auth.uid());