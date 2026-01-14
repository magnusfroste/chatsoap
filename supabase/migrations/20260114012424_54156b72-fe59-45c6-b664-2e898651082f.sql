-- Add user-specific chat actions to conversation_members
ALTER TABLE public.conversation_members 
ADD COLUMN is_archived boolean NOT NULL DEFAULT false,
ADD COLUMN is_pinned boolean NOT NULL DEFAULT false,
ADD COLUMN is_muted boolean NOT NULL DEFAULT false,
ADD COLUMN is_favorite boolean NOT NULL DEFAULT false,
ADD COLUMN is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN deleted_at timestamp with time zone;

-- Create index for commonly filtered columns
CREATE INDEX idx_conversation_members_archived ON public.conversation_members(user_id, is_archived);
CREATE INDEX idx_conversation_members_pinned ON public.conversation_members(user_id, is_pinned);

-- Allow users to update their own membership settings
CREATE POLICY "Users can update their own membership settings"
ON public.conversation_members
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());