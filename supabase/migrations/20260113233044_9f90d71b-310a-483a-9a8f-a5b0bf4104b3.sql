-- Drop the policies that still cause recursion
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view co-members" ON public.conversation_members;

-- Create a security definer function to check conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

-- Create a security definer function to get user's conversation IDs
CREATE OR REPLACE FUNCTION public.get_user_conversation_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_id
  FROM public.conversation_members
  WHERE user_id = _user_id
$$;

-- Create simple SELECT policy using the function
CREATE POLICY "Users can view conversation members" 
ON public.conversation_members 
FOR SELECT 
USING (
  conversation_id IN (SELECT public.get_user_conversation_ids(auth.uid()))
);