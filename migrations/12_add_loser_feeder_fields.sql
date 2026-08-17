-- Migration 12: Persist loser feeder slots for double-elimination internal brackets
ALTER TABLE public.internal_matches
ADD COLUMN IF NOT EXISTS player1_loser_feeder_id UUID REFERENCES public.internal_matches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS player2_loser_feeder_id UUID REFERENCES public.internal_matches(id) ON DELETE SET NULL;
