-- Drop the restrictive policy and create a permissive one
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

-- Create a PERMISSIVE INSERT policy for conversations
CREATE POLICY "Authenticated users can create conversations" 
ON public.conversations 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);