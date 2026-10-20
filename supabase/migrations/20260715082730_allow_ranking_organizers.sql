-- Ranking organizers are opt-in.  This prevents newly created external accounts
-- from generating public points until a Super Admin has approved the organizer.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS ranking_organizer_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Result rows remain available for Super Admin audit.  The view and every
-- ranking query below the application layer exclude disabled organizers, so
-- they never contribute points or appear in any public ranking history.

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
      AND COALESCE(organizer.ranking_organizer_enabled, FALSE) = TRUE
      AND COALESCE(lower(btrim(organizer.username)), '') NOT IN ('test', 'admin2', 'admin', 'superadmin')
) result ON result.player_id = player.id
WHERE player.is_hidden_from_rankings = FALSE
GROUP BY player.id, player.display_name;
