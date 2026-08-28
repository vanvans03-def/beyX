BEGIN;

CREATE OR REPLACE FUNCTION public.notify_beyx_tournament_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
    changed_row record;
    row_data jsonb;
    tournament_key text;
    row_key text;
BEGIN
    changed_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    row_data := pg_catalog.to_jsonb(changed_row);
    tournament_key := CASE
        WHEN TG_TABLE_NAME = 'tournaments' THEN row_data ->> 'id'
        ELSE row_data ->> 'tournament_id'
    END;
    row_key := CASE
        WHEN TG_TABLE_NAME = 'match_locks' THEN row_data ->> 'match_id'
        ELSE row_data ->> 'id'
    END;

    PERFORM pg_catalog.pg_notify(
        'beyx_tournament_updates',
        pg_catalog.json_build_object(
            'tournamentId', tournament_key,
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'rowId', row_key,
            'occurredAt', pg_catalog.clock_timestamp()
        )::text
    );
    RETURN changed_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_beyx_tournament_update() FROM PUBLIC;

DO $do$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['tournaments', 'registrations', 'internal_matches', 'match_locks', 'matches'] LOOP
        EXECUTE pg_catalog.format('DROP TRIGGER IF EXISTS beyx_realtime_notify ON public.%I', table_name);
        EXECUTE pg_catalog.format(
            'CREATE TRIGGER beyx_realtime_notify AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.notify_beyx_tournament_update()',
            table_name
        );
    END LOOP;
END;
$do$;

COMMIT;
