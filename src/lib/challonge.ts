
import axios from 'axios';

// Basic Config
const API_KEY = process.env.CHALLONGE_API_KEY;
const BASE_URL = 'https://api.challonge.com/v1';

interface TournamentResponse {
    tournament: {
        id: number;
        url: string;
        full_challonge_url: string;
        [key: string]: any;
    };
}

interface Participant {
    username: string;
    beyblade_combo: string; // Assuming this maps to 'misc'
}

interface Match {
    id: number;
    tournament_id: number;
    state: string; // "open", "pending", "complete"
    player1_id: number;
    player2_id: number;
    player1_prereq_match_id: number;
    player2_prereq_match_id: number;
    winner_id: number;
    loser_id: number;
    scores_csv: string;
    round: number;
    player1?: ChallongeParticipant; // Enriched
    player2?: ChallongeParticipant; // Enriched
    updated_at?: string;
    completed_at?: string;
}

interface ChallongeParticipant {
    id: number;
    name: string;
    misc?: string;
}

/**
 * 1. Create Tournament
 * @param name - Tournament Name
 * @param urlPath - Unique URL Path
 * @param type - single elimination, double elimination, swiss, round robin
 */
async function createTournament(name: string, urlPath: string, type: string = 'single elimination', quickAdvance: boolean = false) {
    try {
        const response = await axios.post<TournamentResponse>(`${BASE_URL}/tournaments.json`, {
            api_key: API_KEY,
            tournament: {
                name: name,
                url: urlPath,
                tournament_type: type,
                description: 'Hosted by Beyblade Tournament System',
                open_signup: false,
                show_rounds: true,
                quick_advance: quickAdvance
            }
        });
        return response.data.tournament;
    } catch (error: any) {
        console.error('Error creating tournament:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 2. Add Participants (Bulk Add)
 * @param tournamentId - Tournament ID from step 1
 * @param participants - List of players
 */
async function addParticipants(tournamentId: number, participants: Participant[]) {
    const formattedParticipants = participants.map(p => ({
        name: p.username,
        misc: p.beyblade_combo
    }));

    try {
        await axios.post(`${BASE_URL}/tournaments/${tournamentId}/participants/bulk_add.json`, {
            api_key: API_KEY,
            participants: formattedParticipants
        });
    } catch (error: any) {
        console.error('Error adding participants:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 2.5 Shuffle Participants
 * @param tournamentId
 */
async function randomizeParticipants(tournamentId: number) {
    try {
        await axios.post(`${BASE_URL}/tournaments/${tournamentId}/participants/randomize.json`, {
            api_key: API_KEY
        });
    } catch (error: any) {
        console.error('Error shuffling participants:', error.response?.data || error.message);
        throw error;
    }
}


/**
 * 3. Start Tournament (Generate Bracket)
 * @param tournamentId 
 */
async function startTournament(tournamentId: number) {
    try {
        await axios.post(`${BASE_URL}/tournaments/${tournamentId}/start.json`, {
            api_key: API_KEY
        });
    } catch (error: any) {
        console.error('Error starting tournament:', error.response?.data || error.message);
        throw error;
    }
}

// Main Setup Function
export async function setupAndStartTournament(
    roomName: string,
    players: Participant[],
    options: { type?: string; shuffle?: boolean; quickAdvance?: boolean } = {}
) {
    // Generate random URL so it's unique
    const urlPath = `bb_${Date.now()}`;
    const type = options.type || 'single elimination';

    // 1. Create
    const tournament = await createTournament(roomName, urlPath, type, options.quickAdvance);

    // 2. Add Players
    if (players.length > 0) {
        await addParticipants(tournament.id, players);
    }

    // 2.5 Shuffle if requested
    if (options.shuffle) {
        await randomizeParticipants(tournament.id);
    }

    // 3. Start
    if (players.length >= 2) {
        await startTournament(tournament.id);
    } else {
        console.warn("Not enough players to start the tournament automatically.");
    }

    // Return URL
    return {
        url: tournament.full_challonge_url,
        id: tournament.id, // Return ID for persistent storage if needed later
        raw_url: tournament.url // The short identifier
    };
}

/**
 * Get Open Matches for Admin
 */
export async function getMatches(tournamentIdentifier: string) {
    try {
        // Get matches
        const matchesRes = await axios.get(`${BASE_URL}/tournaments/${tournamentIdentifier}/matches.json`, {
            params: { api_key: API_KEY, state: 'all' }
        });

        // Get participants to map names
        const participantsRes = await axios.get(`${BASE_URL}/tournaments/${tournamentIdentifier}/participants.json`, {
            params: { api_key: API_KEY }
        });

        const participantsMap = new Map<number, ChallongeParticipant>();
        participantsRes.data.forEach((p: any) => {
            participantsMap.set(p.participant.id, p.participant);
        });

        return matchesRes.data.map((m: any) => {
            const match = m.match;
            return {
                ...match,
                player1: participantsMap.get(match.player1_id),
                player2: participantsMap.get(match.player2_id)
            };
        });

    } catch (error: any) {
        console.error('Error fetching matches:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Update Match Score and Winner
 */
export async function updateMatch(tournamentIdentifier: string, matchId: number, scoresCsv: string, winnerId: number) {
    try {
        await axios.put(`${BASE_URL}/tournaments/${tournamentIdentifier}/matches/${matchId}.json`, {
            api_key: API_KEY,
            match: {
                scores_csv: scoresCsv,
                winner_id: winnerId
            }
        });
    } catch (error: any) {
        console.error('Error updating match:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Finalize Tournament (Close it)
 */
export async function finalizeTournament(tournamentIdentifier: string) {
    try {
        await axios.post(`${BASE_URL}/tournaments/${tournamentIdentifier}/finalize.json`, {
            api_key: API_KEY
        });
    } catch (error: any) {
        console.error('Error finalizing tournament:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get Tournament Standings
 */
export async function getTournamentStandings(tournamentIdentifier: string) {
    try {
        const response = await axios.get(`${BASE_URL}/tournaments/${tournamentIdentifier}/participants.json`, {
            params: { api_key: API_KEY }
        });

        // Filter valid participants and sort by final_rank
        const standings = response.data
            .map((p: any) => p.participant)
            .filter((p: any) => p.final_rank) // Only ranked players (usually all if completed)
            .sort((a: any, b: any) => a.final_rank - b.final_rank);

        return standings.map((p: any) => ({
            id: p.id,
            rank: p.final_rank,
            name: p.name,
            misc: p.misc // Deck info
        }));

    } catch (error: any) {
        console.error('Error fetching standings:', error.response?.data || error.message);
        throw error;
    }
}
