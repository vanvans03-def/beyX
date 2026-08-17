-- Rankings only include real competitions. Exclusion preserves the original bracket for audit.
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS is_excluded_from_rankings BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.tournaments tournament
SET is_excluded_from_rankings = TRUE
FROM public.users organizer
WHERE organizer.id = tournament.user_id
  AND lower(btrim(organizer.username)) IN ('test', 'admin2', 'admin', 'superadmin');

CREATE OR REPLACE VIEW public.player_ranking_totals
WITH (security_invoker = true)
AS
SELECT
    player.id AS player_id,
    player.display_name,
    COALESCE(SUM(result.points), 0)::integer AS total_points,
    COUNT(*) FILTER (WHERE result.placement = 1)::integer AS championships,
    COUNT(result.id)::integer AS top_four_finishes
FROM public.players player
LEFT JOIN (
    SELECT result.*
    FROM public.tournament_results result
    JOIN public.tournaments tournament ON tournament.id = result.tournament_id
    LEFT JOIN public.users organizer ON organizer.id = tournament.user_id
    WHERE tournament.is_excluded_from_rankings = FALSE
      AND COALESCE(lower(btrim(organizer.username)), '') NOT IN ('test', 'admin2', 'admin', 'superadmin')
) result ON result.player_id = player.id
WHERE player.is_hidden_from_rankings = FALSE
GROUP BY player.id, player.display_name;
