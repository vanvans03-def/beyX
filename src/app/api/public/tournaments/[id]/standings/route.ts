import { NextResponse } from "next/server";
import { getTournament, getUserApiKey } from "@/lib/repository";
import { getTournamentStandings } from "@/lib/challonge";
import { adminDb as supabaseAdmin } from '@/lib/db/admin';
import { getCachedData, setCachedData, singleFlight } from "@/lib/redis";

export const dynamic = 'force-dynamic';

class PublicStandingsError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const cacheKey = `tournament:${id}:standings`;
        const cachedResponse = await getCachedData<{ success: boolean; data: any[] }>(cacheKey);
        if (cachedResponse) {
            return NextResponse.json(cachedResponse);
        }

        const responseData = await singleFlight(cacheKey, async () => {
            const filled = await getCachedData<{ success: boolean; data: any[] }>(cacheKey);
            if (filled) return filled;

            const tournament = await getTournament(id);

            if (!tournament) throw new PublicStandingsError("Tournament not found", 404);

            if (tournament.provider === 'INTERNAL') {
                const { data: matches } = await supabaseAdmin
                    .from('internal_matches')
                    .select('*')
                    .eq('tournament_id', id);
            
            const { data: registrations } = await supabaseAdmin
                .from('registrations')
                .select('id, player_name')
                .eq('tournament_id', id);
            
            const playerMap = new Map((registrations || []).map((r: any) => [r.id, r.player_name] as [string, string]));

                if (!matches || matches.length === 0) {
                    const empty = { success: true, data: [] as any[] };
                    await setCachedData(cacheKey, empty, 3600);
                    return empty;
                }

            const standings: any[] = [];
            const processedIds = new Set<string>();

            const completedMatches = (matches || [])
                .filter((m: any) => m.state === 'COMPLETE' && !m.scores_csv?.includes('Cancelled') && !m.scores_csv?.includes('BYE'));
            const playedWbMatches = completedMatches
                .filter((m: any) => m.round > 0)
                .sort((a: any, b: any) => b.round - a.round);
            const resetFinal = completedMatches
                .filter((m: any) => m.is_reset_match)
                .sort((a: any, b: any) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0];
            const grandFinal = completedMatches
                .filter((m: any) => m.is_grand_final)
                .sort((a: any, b: any) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0];
            const finalMatch = resetFinal || grandFinal || playedWbMatches[0];

            if (finalMatch) {
                const winnerId = finalMatch.winner_id;
                const loserId = finalMatch.winner_id === finalMatch.player1_id ? finalMatch.player2_id : finalMatch.player1_id;

                if (winnerId) {
                    standings.push({ id: winnerId, rank: 1, name: playerMap.get(winnerId) || 'Unknown' });
                    processedIds.add(winnerId);
                }
                if (loserId) {
                    standings.push({ id: loserId, rank: 2, name: playerMap.get(loserId) || 'Unknown' });
                    processedIds.add(loserId);
                }

                const isDoubleElim = (matches || []).some((m: any) => m.round < 0);
                let currentRank = 3;

                if (isDoubleElim) {
                    const losersByLBRound = new Map<number, Set<string>>();
                    matches.filter((m: any) => m.state === 'COMPLETE' && !m.scores_csv?.includes('BYE')).forEach((m: any) => {
                        const lId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id;
                        if (lId && m.round < 0) {
                            const absR = Math.abs(m.round);
                            if (!losersByLBRound.has(absR)) losersByLBRound.set(absR, new Set());
                            losersByLBRound.get(absR)!.add(lId);
                        }
                    });

                    const lbRounds = Array.from(losersByLBRound.keys()).sort((a, b) => b - a);
                    lbRounds.forEach(r => {
                        const playersInThisRound = Array.from(losersByLBRound.get(r)!).filter(id => !processedIds.has(id));
                        if (playersInThisRound.length > 0) {
                            playersInThisRound.forEach(id => {
                                standings.push({ id, rank: currentRank, name: playerMap.get(id) || 'Unknown' });
                                processedIds.add(id);
                            });
                            currentRank += playersInThisRound.length;
                        }
                    });
                } else {
                    const losersByWbRound = new Map<number, Set<string>>();
                    playedWbMatches.forEach((m: any) => {
                        const lId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id;
                        if (lId) {
                            if (!losersByWbRound.has(m.round)) losersByWbRound.set(m.round, new Set());
                            losersByWbRound.get(m.round)!.add(lId);
                        }
                    });

                    const wbRounds = Array.from(losersByWbRound.keys()).sort((a, b) => b - a);
                    wbRounds.forEach(r => {
                        const playersInThisRound = Array.from(losersByWbRound.get(r)!).filter(id => !processedIds.has(id));
                        if (playersInThisRound.length > 0) {
                            playersInThisRound.forEach(id => {
                                standings.push({ id, rank: currentRank, name: playerMap.get(id) || 'Unknown' });
                                processedIds.add(id);
                            });
                            currentRank += playersInThisRound.length;
                        }
                    });
                }
            }

                const internalResponse = { success: true, data: standings };
                await setCachedData(cacheKey, internalResponse, 3600);
                return internalResponse;
            }

            if (!tournament.challonge_url) {
                throw new PublicStandingsError("Tournament not linked to Challonge", 404);
            }

        const challongeUrl = tournament.challonge_url as string;
        const identifier = challongeUrl.split('/').pop();
            if (!identifier) throw new PublicStandingsError("Invalid Challonge URL", 400);

            if (!tournament.user_id) throw new PublicStandingsError("Tournament owner not found", 400);

        const apiKey = await getUserApiKey(tournament.user_id);
        if (!apiKey) throw new Error("Challonge API Key not found for user");

            const standings = await getTournamentStandings(apiKey, identifier);
            const challongeResponse = { success: true, data: standings };
            await setCachedData(cacheKey, challongeResponse, 3600);
            return challongeResponse;
        });
        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error("GET Public Standings Error:", error);
        const errorDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        return NextResponse.json({
            success: false,
            message: error.message,
            details: errorDetail
        }, { status: error instanceof PublicStandingsError ? error.status : 500 });
    }
}
