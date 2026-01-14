-- Create custom personas table
CREATE TABLE public.custom_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  icon TEXT DEFAULT 'sparkles',
  gradient TEXT DEFAULT 'from-violet-500 to-fuchsia-500',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_personas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own custom personas"
ON public.custom_personas FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom personas"
ON public.custom_personas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom personas"
ON public.custom_personas FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom personas"
ON public.custom_personas FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_custom_personas_updated_at
BEFORE UPDATE ON public.custom_personas
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();