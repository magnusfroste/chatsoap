-- Create table for WebRTC signaling
CREATE TABLE public.room_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_signals ENABLE ROW LEVEL SECURITY;

-- Policies for room signals
CREATE POLICY "Users can insert signals" ON public.room_signals
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can read signals addressed to them" ON public.room_signals
  FOR SELECT USING (auth.uid() = to_user_id);

CREATE POLICY "Users can delete their own signals" ON public.room_signals
  FOR DELETE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Enable realtime for signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_signals;

-- Create presence tracking table
CREATE TABLE public.room_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  video_enabled BOOLEAN DEFAULT false,
  audio_enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Enable RLS
ALTER TABLE public.room_presence ENABLE ROW LEVEL SECURITY;

-- Policies for presence
CREATE POLICY "Users can manage their own presence" ON public.room_presence
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Room members can see presence" ON public.room_presence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.room_members 
      WHERE room_members.room_id = room_presence.room_id 
      AND room_members.user_id = auth.uid()
    )
  );

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_presence;