ALTER TABLE public.player_win_rate_totals
    ADD COLUMN IF NOT EXISTS period_month DATE;

UPDATE public.player_win_rate_totals
SET period_month = date_trunc('month', updated_at)::date
WHERE period_month IS NULL;

ALTER TABLE public.player_win_rate_totals
    ALTER COLUMN period_month SET NOT NULL;

ALTER TABLE public.player_win_rate_totals
    DROP CONSTRAINT IF EXISTS player_win_rate_totals_pkey;

ALTER TABLE public.player_win_rate_totals
    ADD PRIMARY KEY (period_month, player_id);

DROP INDEX IF EXISTS public.player_win_rate_totals_ranking_idx;
CREATE INDEX player_win_rate_totals_ranking_idx
    ON public.player_win_rate_totals (period_month, win_rate DESC, wins DESC, matches DESC, display_name ASC);

CREATE OR REPLACE FUNCTION public.refresh_player_win_rate_totals()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.player_win_rate_totals;

    INSERT INTO public.player_win_rate_totals (period_month, player_id, display_name, wins, matches, win_rate, updated_at)
    WITH eligible_tournaments AS (
        SELECT t.id
        FROM public.tournaments t
        INNER JOIN public.users u ON u.id = t.user_id
        WHERE COALESCE(t.is_excluded_from_rankings, false) = false
          AND COALESCE(u.ranking_organizer_enabled, false) = true
          AND lower(COALESCE(u.username, '')) NOT IN ('user test', 'admin2', 'admin', 'superadmin')
    ),
    resolved_matches AS (
        SELECT
            date_trunc('month', m.updated_at)::date AS period_month,
            COALESCE(a1.player_id, h1.player_id, p1.id) AS player1_profile_id,
            COALESCE(a2.player_id, h2.player_id, p2.id) AS player2_profile_id,
            m.player1_id AS player1_registration_id,
            m.player2_id AS player2_registration_id,
            m.winner_id
        FROM public.internal_matches m
        INNER JOIN eligible_tournaments et ON et.id = m.tournament_id
        INNER JOIN public.registrations r1 ON r1.id = m.player1_id
        INNER JOIN public.registrations r2 ON r2.id = m.player2_id
        LEFT JOIN public.player_aliases a1 ON a1.normalized_name = lower(regexp_replace(trim(r1.player_name), '\\s+', ' ', 'g'))
        LEFT JOIN public.player_aliases a2 ON a2.normalized_name = lower(regexp_replace(trim(r2.player_name), '\\s+', ' ', 'g'))
        LEFT JOIN LATERAL (
            SELECT result.player_id FROM public.tournament_results result
            WHERE result.tournament_id = m.tournament_id
              AND lower(regexp_replace(trim(result.player_name_at_award), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r1.player_name), '\\s+', ' ', 'g'))
            LIMIT 1
        ) h1 ON true
        LEFT JOIN LATERAL (
            SELECT result.player_id FROM public.tournament_results result
            WHERE result.tournament_id = m.tournament_id
              AND lower(regexp_replace(trim(result.player_name_at_award), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r2.player_name), '\\s+', ' ', 'g'))
            LIMIT 1
        ) h2 ON true
        LEFT JOIN public.players p1 ON lower(regexp_replace(trim(p1.display_name), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r1.player_name), '\\s+', ' ', 'g'))
        LEFT JOIN public.players p2 ON lower(regexp_replace(trim(p2.display_name), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r2.player_name), '\\s+', ' ', 'g'))
        WHERE m.state = 'COMPLETE'
          AND m.winner_id IS NOT NULL
          AND m.player1_id IS NOT NULL
          AND m.player2_id IS NOT NULL
          AND m.updated_at IS NOT NULL
          AND COALESCE(m.scores_csv, '') NOT ILIKE '%BYE%'
          AND COALESCE(m.scores_csv, '') NOT ILIKE '%Cancelled%'
    ),
    player_games AS (
        SELECT period_month, player1_profile_id AS player_id, (winner_id = player1_registration_id) AS won FROM resolved_matches WHERE player1_profile_id IS NOT NULL
        UNION ALL
        SELECT period_month, player2_profile_id AS player_id, (winner_id = player2_registration_id) AS won FROM resolved_matches WHERE player2_profile_id IS NOT NULL
    ),
    totals AS (
        SELECT period_month, player_id, COUNT(*)::integer AS matches, COUNT(*) FILTER (WHERE won)::integer AS wins
        FROM player_games GROUP BY period_month, player_id
    )
    SELECT totals.period_month, totals.player_id, p.display_name, totals.wins, totals.matches,
        ROUND((totals.wins::numeric / totals.matches::numeric) * 100, 2), now()
    FROM totals
    INNER JOIN public.players p ON p.id = totals.player_id
    WHERE COALESCE(p.is_hidden_from_rankings, false) = false;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_player_win_rate_totals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_player_win_rate_totals() TO service_role;
