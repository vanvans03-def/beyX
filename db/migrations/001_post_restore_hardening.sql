-- Run each CREATE INDEX CONCURRENTLY outside an explicit transaction.
-- This is intentionally safe to rerun and avoids long write locks during cutover rehearsal.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_matches_tournament_id
    ON public.internal_matches (tournament_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_matches_player1_id
    ON public.internal_matches (player1_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_matches_player2_id
    ON public.internal_matches (player2_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_matches_winner_id
    ON public.internal_matches (winner_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_matches_loser_to_match_id
    ON public.internal_matches (loser_to_match_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_matches_player1_prereq_match_id
    ON public.internal_matches (player1_prereq_match_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_matches_player2_prereq_match_id
    ON public.internal_matches (player2_prereq_match_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_matches_player1_loser_feeder_id
    ON public.internal_matches (player1_loser_feeder_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_matches_player2_loser_feeder_id
    ON public.internal_matches (player2_loser_feeder_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tournaments_user_id
    ON public.tournaments (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_win_rate_totals_player_id
    ON public.player_win_rate_totals (player_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.player_ranking_totals FROM beyx_app;
GRANT SELECT ON public.player_ranking_totals TO beyx_app;

ANALYZE public.internal_matches;
ANALYZE public.tournaments;
ANALYZE public.player_win_rate_totals;
