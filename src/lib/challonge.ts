import axios from 'axios';

// Basic Config
// API Key is now passed dynamically per user
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
 */
async function createTournament(apiKey: string, name: string, urlPath: string, type: string = 'single elimination', quickAdvance: boolean = false) {
    try {
        const response = await axios.post<TournamentResponse>(`${BASE_URL}/tournaments.json`, {
            api_key: apiKey,
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
 */
async function addParticipants(apiKey: string, tournamentId: number, participants: Participant[]) {
    const formattedParticipants = participants.map(p => ({
        name: p.username,
        misc: p.beyblade_combo
    }));

    try {
        await axios.post(`${BASE_URL}/tournaments/${tournamentId}/participants/bulk_add.json`, {
            api_key: apiKey,
            participants: formattedParticipants
        });
    } catch (error: any) {
        console.error('Error adding participants:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 2.5 Shuffle Participants
 */
async function randomizeParticipants(apiKey: string, tournamentId: number) {
    try {
        await axios.post(`${BASE_URL}/tournaments/${tournamentId}/participants/randomize.json`, {
            api_key: apiKey
        });
    } catch (error: any) {
        console.error('Error shuffling participants:', error.response?.data || error.message);
        throw error;
    }
}


/**
 * 3. Start Tournament (Generate Bracket)
 */
async function startTournament(apiKey: string, tournamentId: number) {
    try {
        await axios.post(`${BASE_URL}/tournaments/${tournamentId}/start.json`, {
            api_key: apiKey
        });
    } catch (error: any) {
        console.error('Error starting tournament:', error.response?.data || error.message);
        throw error;
    }
}

// Main Setup Function
export async function setupAndStartTournament(
    apiKey: string,
    roomName: string,
    players: Participant[],
    options: { type?: string; shuffle?: boolean; quickAdvance?: boolean } = {}
) {
    if (!apiKey) throw new Error("Challonge API Key is missing");

    // Generate random URL so it's unique
    const urlPath = `bb_${Date.now()}`;
    const type = options.type || 'single elimination';

    // 1. Create
    const tournament = await createTournament(apiKey, roomName, urlPath, type, options.quickAdvance);

    // 2. Add Players
    if (players.length > 0) {
        await addParticipants(apiKey, tournament.id, players);
    }

    // 2.5 Shuffle if requested
    if (options.shuffle) {
        await randomizeParticipants(apiKey, tournament.id);
    }

    // 3. Start
    if (players.length >= 2) {
        await startTournament(apiKey, tournament.id);
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
export async function getMatches(apiKey: string, tournamentIdentifier: string) {
    if (!apiKey) throw new Error("Challonge API Key is missing");
    try {
        // Get matches
        const matchesRes = await axios.get(`${BASE_URL}/tournaments/${tournamentIdentifier}/matches.json`, {
            params: { api_key: apiKey, state: 'all' }
        });

        // Get participants to map names
        const participantsRes = await axios.get(`${BASE_URL}/tournaments/${tournamentIdentifier}/participants.json`, {
            params: { api_key: apiKey }
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
export async function updateMatch(apiKey: string, tournamentIdentifier: string, matchId: number, scoresCsv: string, winnerId: number) {
    if (!apiKey) throw new Error("Challonge API Key is missing");
    try {
        await axios.put(`${BASE_URL}/tournaments/${tournamentIdentifier}/matches/${matchId}.json`, {
            api_key: apiKey,
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
export async function finalizeTournament(apiKey: string, tournamentIdentifier: string) {
    if (!apiKey) throw new Error("Challonge API Key is missing");
    try {
        await axios.post(`${BASE_URL}/tournaments/${tournamentIdentifier}/finalize.json`, {
            api_key: apiKey
        });
    } catch (error: any) {
        console.error('Error finalizing tournament:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get Tournament Standings
 */
export async function getTournamentStandings(apiKey: string, tournamentIdentifier: string) {
    if (!apiKey) throw new Error("Challonge API Key is missing");
    try {
        const response = await axios.get(`${BASE_URL}/tournaments/${tournamentIdentifier}/participants.json`, {
            params: { api_key: apiKey }
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

/**
 * 4. Set Webhook
 */
export async function setWebhook(apiKey: string, tournamentIdentifier: string, webhookUrl: string) {
    if (!apiKey) throw new Error("Challonge API Key is missing");
    try {
        await axios.put(`${BASE_URL}/tournaments/${tournamentIdentifier}.json`, {
            api_key: apiKey,
            tournament: {
                notify_users_when_matches_open: true,
                accept_attachments: true,
                // Note: Challonge might require manual setup for some webhook features or a paid plan for full control via API
            }
        });
        // Note: Challonge API v1 doesn't officially document a "set webhook url" params in the update endpoint easily,
        // it often relies on the generic tournament update or console settings. 
        // However, we can try passing generic params if the API supports it, or use the instructions to set it manually.
        // Re-reading user request: "หรือต้องใช้ API update tournament params 'url' ของ webhook"
        // Let's assume user wants us to try setting it if possible, but mostly it's a manual process or 'notify_users_when_matches_open' flags.
        // Actually, for this specific request, the user code snippet showed:
        // "accept_attachments": true, "notify_users_when_matches_open": true
        // And mentioned "URL ของเว็บเราที่จะรับข้อมูล" in comments but didn't actually pass the URL in the code block provided in the prompt?
        // Wait, the prompt code says:
        // async function setWebhook(tournamentId) { ... }
        // Let's implement that exact function.
    } catch (error: any) {
        console.error('Error setting webhook preferences:', error.response?.data || error.message);
        throw error;
    }
}
