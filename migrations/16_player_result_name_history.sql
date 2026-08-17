ALTER TABLE public.tournament_results
ADD COLUMN IF NOT EXISTS player_name_at_award TEXT;

UPDATE public.tournament_results result
SET player_name_at_award = player.display_name
FROM public.players player
WHERE player.id = result.player_id
  AND result.player_name_at_award IS NULL;

ALTER TABLE public.tournament_results
ALTER COLUMN player_name_at_award SET NOT NULL;

CREATE OR REPLACE FUNCTION public.merge_player_profiles(source_player_id uuid, target_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    source_result public.tournament_results%ROWTYPE;
    source_name text;
BEGIN
    IF source_player_id = target_player_id THEN RAISE EXCEPTION 'Choose two different players'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = target_player_id) THEN RAISE EXCEPTION 'Primary player does not exist'; END IF;
    SELECT display_name INTO source_name FROM public.players WHERE id = source_player_id;
    IF source_name IS NULL THEN RAISE EXCEPTION 'Player to merge does not exist'; END IF;

    DELETE FROM public.player_aliases source_alias USING public.player_aliases target_alias
    WHERE source_alias.player_id = source_player_id AND target_alias.player_id = target_player_id
      AND source_alias.normalized_name = target_alias.normalized_name;
    UPDATE public.player_aliases SET player_id = target_player_id WHERE player_id = source_player_id;

    FOR source_result IN SELECT * FROM public.tournament_results WHERE player_id = source_player_id LOOP
        UPDATE public.tournament_results SET player_name_at_award = source_name
        WHERE id = source_result.id AND player_name_at_award IS NULL;
        IF EXISTS (SELECT 1 FROM public.tournament_results WHERE tournament_id = source_result.tournament_id AND player_id = target_player_id) THEN
            UPDATE public.tournament_results SET points = points + source_result.points,
                placement = LEAST(placement, source_result.placement), updated_at = NOW()
            WHERE tournament_id = source_result.tournament_id AND player_id = target_player_id;
            DELETE FROM public.tournament_results WHERE id = source_result.id;
        ELSE
            UPDATE public.tournament_results SET player_id = target_player_id, updated_at = NOW() WHERE id = source_result.id;
        END IF;
    END LOOP;
    DELETE FROM public.players WHERE id = source_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_player_profiles(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_player_profiles(uuid, uuid) FROM anon, authenticated;
