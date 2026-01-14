-- Add attachment metadata columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS attachment_type TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.messages.attachment_type IS 'Type of attachment: image, pdf, document, etc.';
COMMENT ON COLUMN public.messages.attachment_name IS 'Original filename for document attachments';