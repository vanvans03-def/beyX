-- Migration 07: Internal Brackets Support

-- 1. Update Tournaments Table
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'CHALLONGE' CHECK (provider IN ('CHALLONGE', 'INTERNAL')),
ADD COLUMN IF NOT EXISTS bracket_type TEXT DEFAULT 'SINGLE' CHECK (bracket_type IN ('SINGLE', 'DOUBLE')),
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- 2. Create Internal Matches Table
CREATE TABLE IF NOT EXISTS public.internal_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    player1_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    player2_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    winner_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    player1_prereq_match_id UUID REFERENCES public.internal_matches(id) ON DELETE SET NULL,
    player2_prereq_match_id UUID REFERENCES public.internal_matches(id) ON DELETE SET NULL,
    round INTEGER NOT NULL, -- Positive for Winners, Negative for Losers
    state TEXT NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING', 'OPEN', 'COMPLETE')),
    scores_csv TEXT DEFAULT '',
    suggested_play_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Realtime for internal_matches
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_matches;

-- 4. Enable RLS and Policies
ALTER TABLE public.internal_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for internal_matches" ON public.internal_matches
    FOR SELECT USING (true);

-- (Admins see everything, which is handled by service role in backend apps usually)
