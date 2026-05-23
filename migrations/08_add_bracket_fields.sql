-- Migration 08: Add missing fields to internal_matches
ALTER TABLE public.internal_matches 
ADD COLUMN IF NOT EXISTS is_grand_final BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS loser_to_match_id UUID REFERENCES public.internal_matches(id) ON DELETE SET NULL;
