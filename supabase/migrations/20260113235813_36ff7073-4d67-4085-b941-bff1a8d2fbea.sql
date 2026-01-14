-- Create table for direct calls between users
CREATE TABLE public.direct_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL,
  callee_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'accepted', 'declined', 'ended', 'missed')),
  call_type TEXT NOT NULL DEFAULT 'audio' CHECK (call_type IN ('audio', 'video')),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.direct_calls ENABLE ROW LEVEL SECURITY;

-- Users can view calls they are part of
CREATE POLICY "Users can view their calls"
ON public.direct_calls
FOR SELECT
USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- Users can create calls
CREATE POLICY "Users can create calls"
ON public.direct_calls
FOR INSERT
WITH CHECK (caller_id = auth.uid());

-- Users can update calls they are part of
CREATE POLICY "Users can update their calls"
ON public.direct_calls
FOR UPDATE
USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_calls;

-- Index for faster lookups
CREATE INDEX idx_direct_calls_conversation ON public.direct_calls(conversation_id);
CREATE INDEX idx_direct_calls_callee ON public.direct_calls(callee_id, status);

-- Create table for call signals (WebRTC signaling)
CREATE TABLE public.call_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.direct_calls(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

-- Users can view signals addressed to them
CREATE POLICY "Users can view their signals"
ON public.call_signals
FOR SELECT
USING (to_user_id = auth.uid());

-- Users can insert signals
CREATE POLICY "Users can insert signals"
ON public.call_signals
FOR INSERT
WITH CHECK (from_user_id = auth.uid());

-- Users can delete signals
CREATE POLICY "Users can delete signals"
ON public.call_signals
FOR DELETE
USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;