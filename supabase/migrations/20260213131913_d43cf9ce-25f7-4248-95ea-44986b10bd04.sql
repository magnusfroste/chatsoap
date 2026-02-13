-- Add last_seen_at column to profiles
ALTER TABLE public.profiles ADD COLUMN last_seen_at timestamp with time zone DEFAULT now();

-- Allow any authenticated user to see last_seen (already covered by existing SELECT policy "Users can view all profiles")
-- No new RLS needed since the existing SELECT policy uses `true`