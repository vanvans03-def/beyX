-- Add arena_count to tournaments table
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS arena_count int DEFAULT 0;

-- Add arena to matches table (to persisting where it was played if needed, though primarily for locking)
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS arena int;
