-- Backfill aliases from awarded results. This recovers historic names that
-- existed before aliases were introduced, then points them at the primary
-- profile selected by a merge.
INSERT INTO public.player_aliases (player_id, alias_name, normalized_name)
SELECT DISTINCT
    result.player_id,
    trim(result.player_name_at_award),
    lower(regexp_replace(trim(result.player_name_at_award), '\\s+', ' ', 'g'))
FROM public.tournament_results result
INNER JOIN public.players player ON player.id = result.player_id
WHERE NULLIF(trim(result.player_name_at_award), '') IS NOT NULL
ON CONFLICT (normalized_name) DO NOTHING;

-- Preserve a source profile's main name as an alias before it is removed, so
-- internal match history continues to resolve to the primary profile.
CREATE OR REPLACE FUNCTION public.merge_player_profiles(source_player_id uuid, target_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    source_result public.tournament_results%ROWTYPE;
BEGIN
    IF source_player_id = target_player_id THEN
        RAISE EXCEPTION 'Choose two different players';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = target_player_id) THEN
        RAISE EXCEPTION 'Primary player does not exist';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = source_player_id) THEN
        RAISE EXCEPTION 'Player to merge does not exist';
    END IF;

    INSERT INTO public.player_aliases (player_id, alias_name, normalized_name)
    SELECT target_player_id, source.display_name, lower(regexp_replace(trim(source.display_name), '\\s+', ' ', 'g'))
    FROM public.players source
    WHERE source.id = source_player_id
    ON CONFLICT (normalized_name) DO NOTHING;

    DELETE FROM public.player_aliases source_alias
    USING public.player_aliases target_alias
    WHERE source_alias.player_id = source_player_id
      AND target_alias.player_id = target_player_id
      AND source_alias.normalized_name = target_alias.normalized_name;

    UPDATE public.player_aliases SET player_id = target_player_id WHERE player_id = source_player_id;

    FOR source_result IN SELECT * FROM public.tournament_results WHERE player_id = source_player_id LOOP
        IF EXISTS (
            SELECT 1 FROM public.tournament_results
            WHERE tournament_id = source_result.tournament_id AND player_id = target_player_id
        ) THEN
            UPDATE public.tournament_results
            SET points = points + source_result.points,
                placement = LEAST(placement, source_result.placement),
                updated_at = NOW()
            WHERE tournament_id = source_result.tournament_id AND player_id = target_player_id;
            DELETE FROM public.tournament_results WHERE id = source_result.id;
        ELSE
            UPDATE public.tournament_results SET player_id = target_player_id, updated_at = NOW()
            WHERE id = source_result.id;
        END IF;
    END LOOP;

    DELETE FROM public.players WHERE id = source_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_player_profiles(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_player_profiles(uuid, uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_player_win_rate_totals()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.player_win_rate_totals;

    INSERT INTO public.player_win_rate_totals (player_id, display_name, wins, matches, win_rate, updated_at)
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
            COALESCE(a1.player_id, h1.player_id, p1.id) AS player1_profile_id,
            COALESCE(a2.player_id, h2.player_id, p2.id) AS player2_profile_id,
            m.player1_id AS player1_registration_id,
            m.player2_id AS player2_registration_id,
            m.winner_id
        FROM public.internal_matches m
        INNER JOIN eligible_tournaments et ON et.id = m.tournament_id
        INNER JOIN public.registrations r1 ON r1.id = m.player1_id
        INNER JOIN public.registrations r2 ON r2.id = m.player2_id
        LEFT JOIN public.player_aliases a1
            ON a1.normalized_name = lower(regexp_replace(trim(r1.player_name), '\\s+', ' ', 'g'))
        LEFT JOIN public.player_aliases a2
            ON a2.normalized_name = lower(regexp_replace(trim(r2.player_name), '\\s+', ' ', 'g'))
        LEFT JOIN LATERAL (
            SELECT result.player_id
            FROM public.tournament_results result
            WHERE result.tournament_id = m.tournament_id
              AND lower(regexp_replace(trim(result.player_name_at_award), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r1.player_name), '\\s+', ' ', 'g'))
            LIMIT 1
        ) h1 ON true
        LEFT JOIN LATERAL (
            SELECT result.player_id
            FROM public.tournament_results result
            WHERE result.tournament_id = m.tournament_id
              AND lower(regexp_replace(trim(result.player_name_at_award), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r2.player_name), '\\s+', ' ', 'g'))
            LIMIT 1
        ) h2 ON true
        LEFT JOIN public.players p1
            ON lower(regexp_replace(trim(p1.display_name), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r1.player_name), '\\s+', ' ', 'g'))
        LEFT JOIN public.players p2
            ON lower(regexp_replace(trim(p2.display_name), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(r2.player_name), '\\s+', ' ', 'g'))
        WHERE m.state = 'COMPLETE'
          AND m.winner_id IS NOT NULL
          AND m.player1_id IS NOT NULL
          AND m.player2_id IS NOT NULL
          AND COALESCE(m.scores_csv, '') NOT ILIKE '%BYE%'
          AND COALESCE(m.scores_csv, '') NOT ILIKE '%Cancelled%'
    ),
    player_games AS (
        SELECT player1_profile_id AS player_id, (winner_id = player1_registration_id) AS won FROM resolved_matches WHERE player1_profile_id IS NOT NULL
        UNION ALL
        SELECT player2_profile_id AS player_id, (winner_id = player2_registration_id) AS won FROM resolved_matches WHERE player2_profile_id IS NOT NULL
    ),
    totals AS (
        SELECT player_id, COUNT(*)::integer AS matches, COUNT(*) FILTER (WHERE won)::integer AS wins
        FROM player_games
        GROUP BY player_id
        HAVING COUNT(*) > 5
    )
    SELECT totals.player_id, p.display_name, totals.wins, totals.matches,
        ROUND((totals.wins::numeric / totals.matches::numeric) * 100, 2), now()
    FROM totals
    INNER JOIN public.players p ON p.id = totals.player_id
    WHERE COALESCE(p.is_hidden_from_rankings, false) = false;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_player_win_rate_totals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_player_win_rate_totals() TO service_role;
