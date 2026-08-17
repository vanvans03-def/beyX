/* One-time, repeat-safe backfill for closed Internal tournaments. */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const points = [5, 3, 2, 1];
const normalize = (name) => name.normalize('NFKC').trim().toLocaleLowerCase('th-TH').replace(/\s+/g, ' ');

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

function getTopFour(matches, registrations) {
  const names = new Map(registrations.map((row) => [row.id, row.player_name]));
  const completed = matches.filter((match) => match.state === 'COMPLETE' && match.winner_id && !String(match.scores_csv || '').includes('BYE'));
  const winnerMatches = completed.filter((match) => match.round > 0);
  const final = completed.filter((match) => match.is_reset_match)
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))[0]
    || completed.filter((match) => match.is_grand_final)
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))[0]
    || winnerMatches.sort((a, b) => b.round - a.round || new Date(b.updated_at || 0) - new Date(a.updated_at || 0))[0];
  if (!final) return { standings: [], completedAt: null };

  const standings = [];
  const used = new Set();
  const add = (id) => {
    const name = names.get(id);
    if (name && !used.has(id)) { used.add(id); standings.push(name); }
  };
  add(final.winner_id);
  add(final.winner_id === final.player1_id ? final.player2_id : final.player1_id);
  completed.filter((match) => match.id !== final.id)
    .sort((a, b) => Math.abs(b.round) - Math.abs(a.round) || new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    .forEach((match) => add(match.winner_id === match.player1_id ? match.player2_id : match.player1_id));
  return { standings: standings.slice(0, 4), completedAt: final.updated_at };
}

async function main() {
  const { data: tournaments, error } = await supabase
    .from('tournaments').select('id, name, user_id, created_at').eq('provider', 'INTERNAL').eq('status', 'CLOSED');
  if (error) throw error;

  let imported = 0;
  let skipped = 0;
  for (const tournament of tournaments) {
    if (/test/i.test(tournament.name)) { skipped += 1; continue; }
    const { data: organizer, error: organizerError } = await supabase
      .from('users').select('username, ranking_organizer_enabled').eq('id', tournament.user_id).maybeSingle();
    if (organizerError) throw organizerError;
    if (!organizer?.ranking_organizer_enabled || ['test', 'admin2', 'admin', 'superadmin'].includes((organizer.username || '').trim().toLowerCase())) { skipped += 1; continue; }
    const [{ data: matches, error: matchesError }, { data: registrations, error: registrationsError }] = await Promise.all([
      supabase.from('internal_matches').select('*').eq('tournament_id', tournament.id),
      supabase.from('registrations').select('id, player_name').eq('tournament_id', tournament.id),
    ]);
    if (matchesError) throw matchesError;
    if (registrationsError) throw registrationsError;
    const { standings, completedAt } = getTopFour(matches || [], registrations || []);
    if (standings.length < 2) { skipped += 1; continue; }

    const rows = await Promise.all(standings.map(async (name, index) => ({
      tournament_id: tournament.id,
      player_id: await playerIdFor(name),
      player_name_at_award: name.trim(),
      placement: index + 1,
      points: points[index],
      source: 'INTERNAL',
      tournament_completed_at: completedAt || tournament.created_at,
      awarded_at: new Date().toISOString(),
    })));
    const { error: deleteError } = await supabase.from('tournament_results').delete().eq('tournament_id', tournament.id);
    if (deleteError) throw deleteError;
    const { error: insertError } = await supabase.from('tournament_results').insert(rows);
    if (insertError) throw insertError;
    await supabase.from('tournaments').update({ completed_at: completedAt || tournament.created_at }).eq('id', tournament.id);
    imported += rows.length;
  }
  console.log(JSON.stringify({ imported_results: imported, skipped_tournaments: skipped }));
}

main().catch((error) => { console.error(error.message || error); process.exit(1); });
