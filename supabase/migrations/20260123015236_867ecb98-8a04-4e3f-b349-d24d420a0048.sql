-- Add presenting_user_id to track who is currently presenting
ALTER TABLE public.room_slides 
ADD COLUMN IF NOT EXISTS presenting_user_id UUID DEFAULT NULL;

-- Add presenting_started_at to track when presentation started
ALTER TABLE public.room_slides 
ADD COLUMN IF NOT EXISTS presenting_started_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_room_slides_presenting 
ON public.room_slides(presenting_user_id) 
WHERE presenting_user_id IS NOT NULL;