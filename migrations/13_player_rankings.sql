-- Player identity and tournament ranking ledger.
-- Exact aliases are normalized on import; similar names remain separate until an admin merges them.

ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.player_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    alias_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_player_aliases_player_id ON public.player_aliases(player_id);

CREATE TABLE IF NOT EXISTS public.tournament_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
    placement SMALLINT NOT NULL CHECK (placement BETWEEN 1 AND 4),
    points SMALLINT NOT NULL CHECK (points IN (1, 2, 3, 5)),
    source TEXT NOT NULL CHECK (source IN ('INTERNAL', 'CHALLONGE', 'MANUAL')),
    tournament_completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (tournament_id, player_id),
    UNIQUE (tournament_id, placement)
);

CREATE INDEX IF NOT EXISTS idx_tournament_results_completed_at ON public.tournament_results(tournament_completed_at);
CREATE INDEX IF NOT EXISTS idx_tournament_results_player_id ON public.tournament_results(player_id);

-- Protect write access. Server-side service-role requests bypass these policies.
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read players" ON public.players;
CREATE POLICY "Public read players" ON public.players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read tournament results" ON public.tournament_results;
CREATE POLICY "Public read tournament results" ON public.tournament_results FOR SELECT USING (true);

-- One-time safe cleanup: normalize only case and whitespace variants.
-- Names which merely look similar are deliberately left for admin review.
WITH normalized_names AS (
    SELECT DISTINCT ON (normalized_name)
        normalized_name,
        player_name
    FROM (
        SELECT
            player_name,
            lower(regexp_replace(btrim(player_name), '\\s+', ' ', 'g')) AS normalized_name,
            timestamp
        FROM public.registrations
        WHERE btrim(player_name) <> ''
    ) names
    ORDER BY normalized_name, timestamp NULLS LAST, player_name
), inserted_players AS (
    INSERT INTO public.players (display_name)
    SELECT player_name
    FROM normalized_names
    ON CONFLICT DO NOTHING
    RETURNING id, display_name
)
INSERT INTO public.player_aliases (player_id, alias_name, normalized_name)
SELECT p.id, n.player_name, n.normalized_name
FROM normalized_names n
JOIN inserted_players p ON p.display_name = n.player_name
ON CONFLICT (normalized_name) DO NOTHING;

-- The CTE above only returns newly inserted players. Populate aliases for an already-run migration too.
INSERT INTO public.player_aliases (player_id, alias_name, normalized_name)
SELECT p.id, r.player_name, lower(regexp_replace(btrim(r.player_name), '\\s+', ' ', 'g'))
FROM public.registrations r
JOIN public.players p
  ON p.display_name = r.player_name
WHERE btrim(r.player_name) <> ''
ON CONFLICT (normalized_name) DO NOTHING;
