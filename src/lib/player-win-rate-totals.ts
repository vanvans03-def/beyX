import { supabaseAdmin } from '@/lib/supabase';

/** Rebuilds the small cache used by the public all-time Win Rate leaderboard. */
export async function refreshPlayerWinRateTotals() {
    const { error } = await supabaseAdmin.rpc('refresh_player_win_rate_totals');
    if (error) throw new Error(`Unable to refresh Win Rate standings: ${error.message}`);
}
