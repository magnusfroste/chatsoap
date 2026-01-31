-- Insert built-in transformations with a special system user_id
-- Using a consistent UUID for system/built-in items
INSERT INTO public.transformations (user_id, name, description, prompt, icon, is_default)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'Summarize', 'Condense content to key points', 
   'Summarize the following content concisely, preserving key information and main points. Respond in the same language as the input.

{{content}}', 'file-text', true),
  
  ('00000000-0000-0000-0000-000000000000', 'Extract Action Items', 'Pull out tasks and todos from content', 
   'Extract all action items, tasks, and todos from the following content. Format as a checklist. If no explicit tasks, identify implied next steps.

{{content}}', 'check-square', true),
  
  ('00000000-0000-0000-0000-000000000000', 'Key Points', 'Bullet-point format of main ideas', 
   'Extract the main points from this content as clear, concise bullet points. Focus on the most important information.

{{content}}', 'list', true),
  
  ('00000000-0000-0000-0000-000000000000', 'Generate Q&A', 'Create study questions from content', 
   'Create 5-10 study questions with answers based on this content. Make questions progressively more challenging.

{{content}}', 'help-circle', true),
  
  ('00000000-0000-0000-0000-000000000000', 'Translate', 'Convert content to another language', 
   'Translate the following content to {{targetLanguage}}. Preserve formatting and meaning.

{{content}}', 'languages', true)
ON CONFLICT DO NOTHING;

-- Create RLS policy for transformations to allow users to see built-in + their own
ALTER TABLE public.transformations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view built-in transformations (is_default = true) and their own
CREATE POLICY "Users can view built-in and own transformations"
ON public.transformations
FOR SELECT
USING (
  is_default = true 
  OR auth.uid() = user_id
);

-- Policy: Users can create their own transformations
CREATE POLICY "Users can create own transformations"
ON public.transformations
FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_default IS NOT TRUE);

-- Policy: Users can update their own transformations (not built-ins)
CREATE POLICY "Users can update own transformations"
ON public.transformations
FOR UPDATE
USING (auth.uid() = user_id AND is_default IS NOT TRUE);

-- Policy: Users can delete their own transformations (not built-ins)
CREATE POLICY "Users can delete own transformations"
ON public.transformations
FOR DELETE
USING (auth.uid() = user_id AND is_default IS NOT TRUE);