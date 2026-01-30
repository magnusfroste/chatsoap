-- Table for single-use chat invite links
CREATE TABLE public.chat_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_by UUID,
  used_at TIMESTAMP WITH TIME ZONE,
  -- For new conversations (when conversation_id is null)
  conversation_name TEXT
);

-- Enable RLS
ALTER TABLE public.chat_invite_links ENABLE ROW LEVEL SECURITY;

-- Anyone can view unused invite links (to validate them)
CREATE POLICY "Anyone can view unused invite links"
  ON public.chat_invite_links FOR SELECT
  USING (used_by IS NULL);

-- Authenticated users can create invite links
CREATE POLICY "Authenticated users can create invite links"
  ON public.chat_invite_links FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Anyone can use (update) an unused invite link
CREATE POLICY "Anyone can use invite links"
  ON public.chat_invite_links FOR UPDATE
  USING (used_by IS NULL);

-- Creators can view their own invite links (even used ones)
CREATE POLICY "Creators can view their invite links"
  ON public.chat_invite_links FOR SELECT
  USING (created_by = auth.uid());