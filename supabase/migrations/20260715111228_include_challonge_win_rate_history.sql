-- Link legacy Challonge match IDs to an approved app tournament only when the
-- local date and at least two final-standing names agree. Ambiguous links are
-- deliberately excluded so a match cannot be counted for the wrong organizer.
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
        SELECT t.id, t.provider, t.completed_at
        FROM public.tournaments t
        INNER JOIN public.users u ON u.id = t.user_id
        WHERE COALESCE(t.is_excluded_from_rankings, false) = false
          AND COALESCE(u.ranking_organizer_enabled, false) = true
          AND lower(COALESCE(u.username, '')) NOT IN ('user test', 'admin2', 'admin', 'superadmin')
    ),
    challonge_candidate_scores AS (
        SELECT
            m.tournament_id AS challonge_tournament_id,
            et.id AS app_tournament_id,
            COUNT(DISTINCT result.player_id) AS name_overlap,
            COUNT(DISTINCT m.id) AS match_count
        FROM public.matches m
        INNER JOIN eligible_tournaments et
            ON et.provider = 'CHALLONGE'
           AND (et.completed_at AT TIME ZONE 'Asia/Bangkok')::date = (m.completed_at AT TIME ZONE 'Asia/Bangkok')::date
        INNER JOIN public.tournament_results result ON result.tournament_id = et.id
        WHERE lower(m.state) = 'complete'
          AND m.winner_id IS NOT NULL
          AND (
            lower(regexp_replace(trim(result.player_name_at_award), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(COALESCE(m.player1_name, '')), '\\s+', ' ', 'g'))
            OR lower(regexp_replace(trim(result.player_name_at_award), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(COALESCE(m.player2_name, '')), '\\s+', ' ', 'g'))
          )
        GROUP BY m.tournament_id, et.id
        HAVING COUNT(DISTINCT result.player_id) >= 2
    ),
    challonge_best_per_external AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY challonge_tournament_id ORDER BY name_overlap DESC, match_count DESC, app_tournament_id) AS external_rank
        FROM challonge_candidate_scores
    ),
    challonge_unique_links AS (
        SELECT link.challonge_tournament_id, link.app_tournament_id
        FROM challonge_best_per_external link
        WHERE link.external_rank = 1
          AND 1 = (
            SELECT COUNT(*) FROM challonge_best_per_external other
            WHERE other.app_tournament_id = link.app_tournament_id AND other.external_rank = 1
          )
    ),
    internal_resolved AS (
        SELECT
            date_trunc('month', m.updated_at AT TIME ZONE 'Asia/Bangkok')::date AS period_month,
            COALESCE(a1.player_id, h1.player_id, p1.id) AS player1_profile_id,
            COALESCE(a2.player_id, h2.player_id, p2.id) AS player2_profile_id,
            m.player1_id::text AS player1_key,
            m.player2_id::text AS player2_key,
            m.winner_id::text AS winner_key
        FROM public.internal_matches m
        INNER JOIN eligible_tournaments et ON et.id = m.tournament_id
        INNER JOIN public.registrations r1 ON r1.id = m.player1_id
        INNER JOIN public.registrations r2 ON r2.id = m.player2_id
        LEFT JOIN public.player_aliases a1 ON a1.normalized_name = lower(regexp_replace(trim(r1.player_name), '\\s+', ' ', 'g'))
        LEFT JOIN public.player_aliases a2 ON a2.normalized_name = lower(regexp_replace(trim(r2.player_name), '\\s+', ' ', 'g'))
        LEFT JOIN LATERAL (SELECT result.player_id FROM public.tournament_results result WHERE result.tournament_id = m.tournament_id AND lower(regexp_replace(trim(result.player_name_at_award), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r1.player_name), '\\s+', ' ', 'g')) LIMIT 1) h1 ON true
        LEFT JOIN LATERAL (SELECT result.player_id FROM public.tournament_results result WHERE result.tournament_id = m.tournament_id AND lower(regexp_replace(trim(result.player_name_at_award), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r2.player_name), '\\s+', ' ', 'g')) LIMIT 1) h2 ON true
        LEFT JOIN public.players p1 ON lower(regexp_replace(trim(p1.display_name), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r1.player_name), '\\s+', ' ', 'g'))
        LEFT JOIN public.players p2 ON lower(regexp_replace(trim(p2.display_name), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r2.player_name), '\\s+', ' ', 'g'))
        WHERE m.state = 'COMPLETE' AND m.winner_id IS NOT NULL AND m.player1_id IS NOT NULL AND m.player2_id IS NOT NULL
          AND m.updated_at IS NOT NULL
          AND COALESCE(m.scores_csv, '') NOT ILIKE '%BYE%'
          AND COALESCE(m.scores_csv, '') NOT ILIKE '%Cancelled%'
    ),
    challonge_resolved AS (
        SELECT
            date_trunc('month', m.completed_at AT TIME ZONE 'Asia/Bangkok')::date AS period_month,
            COALESCE(a1.player_id, h1.player_id, p1.id) AS player1_profile_id,
            COALESCE(a2.player_id, h2.player_id, p2.id) AS player2_profile_id,
            m.player1_id::text AS player1_key,
            m.player2_id::text AS player2_key,
            m.winner_id::text AS winner_key
        FROM public.matches m
        INNER JOIN challonge_unique_links link ON link.challonge_tournament_id = m.tournament_id
        LEFT JOIN public.player_aliases a1 ON a1.normalized_name = lower(regexp_replace(trim(COALESCE(m.player1_name, '')), '\\s+', ' ', 'g'))
        LEFT JOIN public.player_aliases a2 ON a2.normalized_name = lower(regexp_replace(trim(COALESCE(m.player2_name, '')), '\\s+', ' ', 'g'))
        LEFT JOIN LATERAL (SELECT result.player_id FROM public.tournament_results result WHERE result.tournament_id = link.app_tournament_id AND lower(regexp_replace(trim(result.player_name_at_award), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(COALESCE(m.player1_name, '')), '\\s+', ' ', 'g')) LIMIT 1) h1 ON true
        LEFT JOIN LATERAL (SELECT result.player_id FROM public.tournament_results result WHERE result.tournament_id = link.app_tournament_id AND lower(regexp_replace(trim(result.player_name_at_award), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(COALESCE(m.player2_name, '')), '\\s+', ' ', 'g')) LIMIT 1) h2 ON true
        LEFT JOIN public.players p1 ON lower(regexp_replace(trim(p1.display_name), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(COALESCE(m.player1_name, '')), '\\s+', ' ', 'g'))
        LEFT JOIN public.players p2 ON lower(regexp_replace(trim(p2.display_name), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(COALESCE(m.player2_name, '')), '\\s+', ' ', 'g'))
        WHERE lower(m.state) = 'complete' AND m.winner_id IS NOT NULL AND m.player1_id IS NOT NULL AND m.player2_id IS NOT NULL
          AND m.completed_at IS NOT NULL
          AND COALESCE(m.score_csv, '') NOT ILIKE '%BYE%'
          AND COALESCE(m.score_csv, '') NOT ILIKE '%Cancelled%'
    ),
    all_matches AS (
        SELECT * FROM internal_resolved
        UNION ALL
        SELECT * FROM challonge_resolved
    ),
    player_games AS (
        SELECT period_month, player1_profile_id AS player_id, (winner_key = player1_key) AS won FROM all_matches WHERE player1_profile_id IS NOT NULL
        UNION ALL
        SELECT period_month, player2_profile_id AS player_id, (winner_key = player2_key) AS won FROM all_matches WHERE player2_profile_id IS NOT NULL
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
