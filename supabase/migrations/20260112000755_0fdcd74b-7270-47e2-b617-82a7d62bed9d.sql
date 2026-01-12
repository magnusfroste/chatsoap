-- Create table for message reactions
CREATE TABLE public.message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view reactions on messages they can see
CREATE POLICY "Users can view reactions on accessible messages"
ON public.message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_reactions.message_id
    AND (
      (m.conversation_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = m.conversation_id
        AND cm.user_id = auth.uid()
      ))
      OR
      EXISTS (
        SELECT 1 FROM public.room_members rm
        WHERE rm.room_id = m.room_id
        AND rm.user_id = auth.uid()
      )
    )
  )
);

-- Users can add reactions to messages they can see
CREATE POLICY "Users can add reactions to accessible messages"
ON public.message_reactions
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_reactions.message_id
    AND (
      (m.conversation_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = m.conversation_id
        AND cm.user_id = auth.uid()
      ))
      OR
      EXISTS (
        SELECT 1 FROM public.room_members rm
        WHERE rm.room_id = m.room_id
        AND rm.user_id = auth.uid()
      )
    )
  )
);

-- Users can remove their own reactions
CREATE POLICY "Users can remove their own reactions"
ON public.message_reactions
FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;