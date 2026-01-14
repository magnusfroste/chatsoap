-- Add persona column to conversations for AI chat personas
ALTER TABLE public.conversations 
ADD COLUMN persona TEXT DEFAULT NULL;