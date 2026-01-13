-- Make room_id nullable for conversation-based messages
ALTER TABLE public.messages ALTER COLUMN room_id DROP NOT NULL;

-- Update the INSERT policy for conversation messages to not require room_id
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;

CREATE POLICY "Users can send messages to their conversations"
ON public.messages
FOR INSERT
WITH CHECK (
  (conversation_id IS NOT NULL) 
  AND (user_id = auth.uid() OR user_id IS NULL)
  AND EXISTS (
    SELECT 1
    FROM conversation_members
    WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
  )
);

-- Also update the room messages INSERT policy to be clearer
DROP POLICY IF EXISTS "Room members can send messages" ON public.messages;

CREATE POLICY "Room members can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  (room_id IS NOT NULL)
  AND (user_id = auth.uid() OR user_id IS NULL)
  AND EXISTS (
    SELECT 1
    FROM room_members
    WHERE room_members.room_id = messages.room_id
      AND room_members.user_id = auth.uid()
  )
);