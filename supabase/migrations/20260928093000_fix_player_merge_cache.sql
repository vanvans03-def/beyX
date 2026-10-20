-- Merge cache rows directly when two player profiles are merged.  Rebuilding
-- every Win Rate row here can take several minutes because it scans all match
-- history, which previously caused the Super Admin merge request to time out.
CREATE OR REPLACE FUNCTION public.merge_player_win_rate_totals(source_player_id uuid, target_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target_name text;
BEGIN
    SELECT display_name INTO target_name
    FROM public.players
    WHERE id = target_player_id;

    -- The profile merge validates both IDs first.  This guard also makes the
    -- helper harmless if it is ever invoked independently.
    IF target_name IS NULL OR to_regclass('public.player_win_rate_totals') IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.player_win_rate_totals (
        period_month, player_id, display_name, wins, matches, win_rate, updated_at
    )
    SELECT
        total.period_month,
        target_player_id,
        target_name,
        SUM(total.wins)::integer,
        SUM(total.matches)::integer,
        ROUND((SUM(total.wins)::numeric / NULLIF(SUM(total.matches), 0)::numeric) * 100, 2),
        now()
    FROM public.player_win_rate_totals total
    WHERE total.player_id IN (source_player_id, target_player_id)
    GROUP BY total.period_month
    ON CONFLICT (period_month, player_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        wins = EXCLUDED.wins,
        matches = EXCLUDED.matches,
        win_rate = EXCLUDED.win_rate,
        updated_at = EXCLUDED.updated_at;

    DELETE FROM public.player_win_rate_totals WHERE player_id = source_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_player_win_rate_totals(uuid, uuid) FROM PUBLIC;

-- Keep the source name as an alias, move every awarded result and fold cached
-- Win Rate history before removing the source profile.
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

    UPDATE public.player_aliases
    SET player_id = target_player_id
    WHERE player_id = source_player_id;

    FOR source_result IN
        SELECT * FROM public.tournament_results WHERE player_id = source_player_id
    LOOP
        IF EXISTS (
            SELECT 1 FROM public.tournament_results
            WHERE tournament_id = source_result.tournament_id AND player_id = target_player_id
        ) THEN
            UPDATE public.tournament_results
            SET points = points + source_result.points,
                placement = LEAST(placement, source_result.placement),
                updated_at = now()
            WHERE tournament_id = source_result.tournament_id AND player_id = target_player_id;
            DELETE FROM public.tournament_results WHERE id = source_result.id;
        ELSE
            UPDATE public.tournament_results
            SET player_id = target_player_id, updated_at = now()
            WHERE id = source_result.id;
        END IF;
    END LOOP;

    PERFORM public.merge_player_win_rate_totals(source_player_id, target_player_id);
    DELETE FROM public.players WHERE id = source_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_player_profiles(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_player_profiles(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_player_profiles(uuid, uuid) TO service_role;
