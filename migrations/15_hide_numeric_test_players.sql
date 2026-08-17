ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS is_hidden_from_rankings BOOLEAN NOT NULL DEFAULT FALSE;

-- Numeric placeholders 1–255 came from imported test brackets, not player identities.
UPDATE public.players
SET is_hidden_from_rankings = TRUE
WHERE CASE
    WHEN display_name ~ '^[0-9]+$' THEN display_name::integer BETWEEN 1 AND 255
    ELSE FALSE
END;

CREATE OR REPLACE VIEW public.player_ranking_totals
WITH (security_invoker = true)
AS
SELECT
    p.id AS player_id,
    p.display_name,
    COALESCE(SUM(r.points), 0)::integer AS total_points,
    COUNT(*) FILTER (WHERE r.placement = 1)::integer AS championships,
    COUNT(r.id)::integer AS top_four_finishes
FROM public.players p
LEFT JOIN public.tournament_results r ON r.player_id = p.id
WHERE p.is_hidden_from_rankings = FALSE
GROUP BY p.id, p.display_name;
