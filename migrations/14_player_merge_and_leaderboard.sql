-- Support profile merging while retaining the selected primary name and all points.

ALTER TABLE public.tournament_results
DROP CONSTRAINT IF EXISTS tournament_results_points_check;

ALTER TABLE public.tournament_results
ADD CONSTRAINT tournament_results_points_check CHECK (points > 0);

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
GROUP BY p.id, p.display_name;

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

    -- Retain the primary name selected by the administrator. Duplicate normalized aliases
    -- already owned by the primary profile are removed before moving the remaining aliases.
    DELETE FROM public.player_aliases source_alias
    USING public.player_aliases target_alias
    WHERE source_alias.player_id = source_player_id
      AND target_alias.player_id = target_player_id
      AND source_alias.normalized_name = target_alias.normalized_name;

    UPDATE public.player_aliases
    SET player_id = target_player_id
    WHERE player_id = source_player_id;

    -- A genuine alias normally has one result per tournament. If historical data has two,
    -- preserve both points in the primary record and retain the best placement.
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
                updated_at = NOW()
            WHERE tournament_id = source_result.tournament_id AND player_id = target_player_id;
            DELETE FROM public.tournament_results WHERE id = source_result.id;
        ELSE
            UPDATE public.tournament_results
            SET player_id = target_player_id, updated_at = NOW()
            WHERE id = source_result.id;
        END IF;
    END LOOP;

    DELETE FROM public.players WHERE id = source_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_player_profiles(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_player_profiles(uuid, uuid) FROM anon, authenticated;
