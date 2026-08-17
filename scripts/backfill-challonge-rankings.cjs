/* One-time, repeat-safe backfill for closed Challonge tournaments. */
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
const points = [5, 3, 2, 1];
const normalize = (name) => name.normalize('NFKC').trim().toLocaleLowerCase('th-TH').replace(/\s+/g, ' ');

function identifierFrom(url) {
  if (!url) return null;
  return url.replace(/\/$/, '').split('/').pop() || null;
}

async function playerIdFor(name) {
  const normalized = normalize(name);
  const { data: alias, error: aliasError } = await supabase
    .from('player_aliases').select('player_id').eq('normalized_name', normalized).maybeSingle();
  if (aliasError) throw aliasError;
  if (alias) return alias.player_id;

  const { data: player, error: playerError } = await supabase
    .from('players').insert({ display_name: name.trim() }).select('id').single();
  if (playerError) throw playerError;
  const { error: insertAliasError } = await supabase
    .from('player_aliases').insert({ player_id: player.id, alias_name: name.trim(), normalized_name: normalized });
  if (insertAliasError) throw insertAliasError;
  return player.id;
}

async function standingsFor(apiKey, identifier) {
  const { data } = await axios.get(`https://api.challonge.com/v1/tournaments/${identifier}/participants.json`, {
    params: { api_key: apiKey },
    timeout: 15000,
  });
  return data
    .map((row) => row.participant)
    .filter((participant) => participant.final_rank && participant.name?.trim())
    .sort((a, b) => a.final_rank - b.final_rank)
    .slice(0, 4);
}

async function main() {
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('id, name, user_id, challonge_url, created_at, completed_at')
    .eq('provider', 'CHALLONGE')
    .eq('status', 'CLOSED');
  if (error) throw error;

  let imported = 0;
  let skipped = 0;
  const failures = [];
  for (const tournament of tournaments || []) {
    if (/test/i.test(tournament.name) || !tournament.challonge_url) { skipped += 1; continue; }
    try {
      const { data: owner, error: ownerError } = await supabase
        .from('users').select('challonge_api_key, username, ranking_organizer_enabled').eq('id', tournament.user_id).maybeSingle();
      if (ownerError || !owner?.challonge_api_key) throw new Error('Missing owner Challonge API key');
      if (!owner.ranking_organizer_enabled || ['test', 'admin2', 'admin', 'superadmin'].includes((owner.username || '').trim().toLowerCase())) { skipped += 1; continue; }

      const standings = await standingsFor(owner.challonge_api_key, identifierFrom(tournament.challonge_url));
      if (standings.length < 2) { skipped += 1; continue; }
      const rows = await Promise.all(standings.map(async (standing, index) => ({
        tournament_id: tournament.id,
        player_id: await playerIdFor(standing.name),
        player_name_at_award: standing.name.trim(),
        placement: index + 1,
        points: points[index],
        source: 'CHALLONGE',
        tournament_completed_at: tournament.completed_at || tournament.created_at,
        awarded_at: new Date().toISOString(),
      })));
      const { error: deleteError } = await supabase.from('tournament_results').delete().eq('tournament_id', tournament.id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from('tournament_results').insert(rows);
      if (insertError) throw insertError;
      await supabase.from('tournaments').update({ completed_at: tournament.completed_at || tournament.created_at }).eq('id', tournament.id);
      imported += rows.length;
    } catch (error) {
      failures.push({ tournament: tournament.name, error: error.response?.data?.errors || error.message || String(error) });
    }
  }
  console.log(JSON.stringify({ imported_results: imported, skipped_tournaments: skipped, failures }, null, 2));
}

main().catch((error) => { console.error(error.message || error); process.exit(1); });
