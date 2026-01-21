-- Create table for code sandbox state (similar to room_canvas)
CREATE TABLE public.room_code_sandbox (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  code TEXT DEFAULT '',
  language TEXT DEFAULT 'javascript',
  last_output TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(room_id)
);

-- Enable RLS
ALTER TABLE public.room_code_sandbox ENABLE ROW LEVEL SECURITY;

-- Policies for room members
CREATE POLICY "Room members can view code sandbox"
ON public.room_code_sandbox FOR SELECT
USING (EXISTS (
  SELECT 1 FROM room_members
  WHERE room_members.room_id = room_code_sandbox.room_id
  AND room_members.user_id = auth.uid()
));

CREATE POLICY "Room members can create code sandbox"
ON public.room_code_sandbox FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM room_members
  WHERE room_members.room_id = room_code_sandbox.room_id
  AND room_members.user_id = auth.uid()
));

CREATE POLICY "Room members can update code sandbox"
ON public.room_code_sandbox FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM room_members
  WHERE room_members.room_id = room_code_sandbox.room_id
  AND room_members.user_id = auth.uid()
));

-- Enable realtime for collaboration
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_code_sandbox;