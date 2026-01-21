-- Insert default LLM settings
INSERT INTO public.app_settings (key, value, updated_at)
VALUES 
  ('llm_provider', '"lovable"'::jsonb, now()),
  ('llm_openai_model', '"gpt-4o"'::jsonb, now()),
  ('llm_gemini_model', '"gemini-2.5-flash"'::jsonb, now()),
  ('llm_custom_config', '{"url": "", "model": ""}'::jsonb, now())
ON CONFLICT (key) DO NOTHING;