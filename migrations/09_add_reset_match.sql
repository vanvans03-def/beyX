-- Migration 09: Add is_reset_match to internal_matches
ALTER TABLE public.internal_matches 
ADD COLUMN IF NOT EXISTS is_reset_match BOOLEAN DEFAULT FALSE;
