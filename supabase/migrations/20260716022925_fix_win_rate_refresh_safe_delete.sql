-- safeupdate rejects DELETE statements without a WHERE clause, including
-- statements inside RPC functions. Preserve the current function definition
-- and make its full-cache replacement explicit.
DO $migration$
DECLARE
    function_definition text;
BEGIN
    SELECT pg_get_functiondef('public.refresh_player_win_rate_totals()'::regprocedure)
    INTO function_definition;

    IF strpos(function_definition, 'DELETE FROM public.player_win_rate_totals;') > 0 THEN
        function_definition := replace(
            function_definition,
            'DELETE FROM public.player_win_rate_totals;',
            'DELETE FROM public.player_win_rate_totals WHERE true;'
        );
        EXECUTE function_definition;
    ELSIF strpos(function_definition, 'DELETE FROM public.player_win_rate_totals WHERE true;') = 0 THEN
        RAISE EXCEPTION 'Expected cache DELETE statement was not found in refresh_player_win_rate_totals()';
    END IF;
END;
$migration$;
