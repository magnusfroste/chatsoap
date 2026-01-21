
-- Create trigger function to auto-add creator as member
CREATE OR REPLACE FUNCTION public.auto_add_conversation_creator_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically add the creator as a member of the conversation
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (NEW.id, NEW.created_by)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on conversations table
DROP TRIGGER IF EXISTS on_conversation_created_add_member ON public.conversations;
CREATE TRIGGER on_conversation_created_add_member
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_conversation_creator_as_member();

-- Fix existing conversations without creator as member
INSERT INTO public.conversation_members (conversation_id, user_id)
SELECT c.id, c.created_by
FROM public.conversations c
WHERE NOT EXISTS (
  SELECT 1 FROM public.conversation_members cm 
  WHERE cm.conversation_id = c.id AND cm.user_id = c.created_by
)
ON CONFLICT DO NOTHING;
