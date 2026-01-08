-- Drop the problematic policies
DROP POLICY IF EXISTS "Room members can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Members can view room members" ON public.room_members;

-- Create a security definer function to check room membership
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_members
    WHERE room_id = _room_id
      AND user_id = _user_id
  )
$$;

-- Create new non-recursive policies for rooms
CREATE POLICY "Room members can view rooms" 
ON public.rooms 
FOR SELECT 
USING (public.is_room_member(id, auth.uid()) OR created_by = auth.uid());

-- Create new non-recursive policies for room_members
CREATE POLICY "Members can view room members" 
ON public.room_members 
FOR SELECT 
USING (public.is_room_member(room_id, auth.uid()));