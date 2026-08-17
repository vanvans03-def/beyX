-- Restore historic display names for results that predate player_name_at_award.
-- Aliases are retained after merge, and registrations preserve the name used in each tournament.
UPDATE public.tournament_results result
SET player_name_at_award = (
    SELECT registration.player_name
    FROM public.registrations registration
    JOIN public.player_aliases alias
      ON alias.player_id = result.player_id
     AND alias.normalized_name = lower(regexp_replace(btrim(registration.player_name), '\\s+', ' ', 'g'))
    WHERE registration.tournament_id = result.tournament_id
    ORDER BY registration.timestamp NULLS LAST, registration.player_name
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM public.registrations registration
    JOIN public.player_aliases alias
      ON alias.player_id = result.player_id
     AND alias.normalized_name = lower(regexp_replace(btrim(registration.player_name), '\\s+', ' ', 'g'))
    WHERE registration.tournament_id = result.tournament_id
);
