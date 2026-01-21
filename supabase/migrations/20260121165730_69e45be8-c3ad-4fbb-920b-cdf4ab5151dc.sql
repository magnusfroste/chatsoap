-- Add soft delete column for attachments
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS is_attachment_deleted BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.messages.is_attachment_deleted IS 'Indicates if the file attachment has been soft-deleted. The message remains but shows a placeholder instead of the file.';

-- Allow users to update their own messages (for soft delete)
CREATE POLICY "Users can update their own messages" 
ON public.messages 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());