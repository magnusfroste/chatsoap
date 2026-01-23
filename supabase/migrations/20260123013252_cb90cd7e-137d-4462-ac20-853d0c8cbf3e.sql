-- Create room_slides table for collaborative presentations
CREATE TABLE public.room_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_slide INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'dark',
  title TEXT DEFAULT 'Untitled Presentation',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id)
);

-- Enable RLS
ALTER TABLE public.room_slides ENABLE ROW LEVEL SECURITY;

-- RLS policies - room members can manage slides
CREATE POLICY "Room members can view slides"
ON public.room_slides
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM room_members
  WHERE room_members.room_id = room_slides.room_id
  AND room_members.user_id = auth.uid()
));

CREATE POLICY "Room members can create slides"
ON public.room_slides
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM room_members
  WHERE room_members.room_id = room_slides.room_id
  AND room_members.user_id = auth.uid()
));

CREATE POLICY "Room members can update slides"
ON public.room_slides
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM room_members
  WHERE room_members.room_id = room_slides.room_id
  AND room_members.user_id = auth.uid()
));

-- Enable realtime for collaborative editing
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_slides;