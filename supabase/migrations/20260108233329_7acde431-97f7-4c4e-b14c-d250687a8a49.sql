-- Create table for canvas state
CREATE TABLE public.room_canvas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  canvas_data JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(room_id)
);

-- Enable RLS
ALTER TABLE public.room_canvas ENABLE ROW LEVEL SECURITY;

-- Room members can view canvas
CREATE POLICY "Room members can view canvas"
ON public.room_canvas FOR SELECT
USING (EXISTS (
  SELECT 1 FROM room_members
  WHERE room_members.room_id = room_canvas.room_id
  AND room_members.user_id = auth.uid()
));

-- Room members can insert canvas
CREATE POLICY "Room members can insert canvas"
ON public.room_canvas FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM room_members
  WHERE room_members.room_id = room_canvas.room_id
  AND room_members.user_id = auth.uid()
));

-- Room members can update canvas
CREATE POLICY "Room members can update canvas"
ON public.room_canvas FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM room_members
  WHERE room_members.room_id = room_canvas.room_id
  AND room_members.user_id = auth.uid()
));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_canvas;