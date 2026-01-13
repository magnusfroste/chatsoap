-- Create table for message read receipts
CREATE TABLE public.message_read_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Users can view read receipts for messages in their conversations
CREATE POLICY "Users can view read receipts in their conversations"
ON public.message_read_receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE m.id = message_read_receipts.message_id
    AND cm.user_id = auth.uid()
  )
);

-- Users can insert read receipts for messages they can see
CREATE POLICY "Users can mark messages as read"
ON public.message_read_receipts
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM messages m
    JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE m.id = message_read_receipts.message_id
    AND cm.user_id = auth.uid()
  )
);

-- Enable realtime for read receipts
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts;

-- Create index for faster lookups
CREATE INDEX idx_message_read_receipts_message_id ON public.message_read_receipts(message_id);
CREATE INDEX idx_message_read_receipts_user_id ON public.message_read_receipts(user_id);