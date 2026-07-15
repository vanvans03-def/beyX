
import { NextResponse } from "next/server";
import { getTournament, getUserApiKey } from "@/lib/repository";
import { getTournamentStandings } from "@/lib/challonge";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        
        const { id } = await params;
        const tournament = await getTournament(id);

        if (!tournament) {
            return NextResponse.json({ success: false, message: "Tournament not found" }, { status: 404 });
        }

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
                return NextResponse.json({ success: true, data: [] });
            }

            const standings: any[] = [];
            const processedIds = new Set<string>();

            // Calculate stats for all players to use as tie-breakers
            const playerStats = new Map<string, { wins: number, total: number }>();


            (matches || []).forEach((m: any) => {
                if (m.state === 'COMPLETE' && !m.scores_csv?.includes('BYE')) {
                    if (m.player1_id) {
                        const s1 = playerStats.get(m.player1_id) || { wins: 0, total: 0 };
                        s1.total++;
                        if (m.winner_id === m.player1_id) s1.wins++;
                        playerStats.set(m.player1_id, s1);
                    }
                    if (m.player2_id) {
                        const s2 = playerStats.get(m.player2_id) || { wins: 0, total: 0 };
                        s2.total++;
                        if (m.winner_id === m.player2_id) s2.wins++;
                        playerStats.set(m.player2_id, s2);
                    }
                }
            });

            const getTieBreakerSort = (aId: string, bId: string) => {
                const sA = playerStats.get(aId) || { wins: 0, total: 0 };
                const sB = playerStats.get(bId) || { wins: 0, total: 0 };
                if (sA.wins !== sB.wins) return sB.wins - sA.wins;
                return sB.total - sA.total;
            };

            const playedWbMatches = (matches || [])
                .filter((m: any) => m.round > 0 && m.state === 'COMPLETE' && !m.scores_csv?.includes('Cancelled'))
                .sort((a: any, b: any) => b.round - a.round);
            
            // A completed reset game is always the championship decider. The
            // first Grand Final only decides the champion when no reset was
            // played (the winners-bracket finalist won it).
            const isDoubleElim = (matches || []).some((m: any) => m.round < 0);
            const resetFinal = (matches || [])
                .filter((m: any) => m.is_reset_match && m.state === 'COMPLETE' && !m.scores_csv?.includes('Cancelled') && !m.scores_csv?.includes('BYE'))
                .sort((a: any, b: any) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0];
            const grandFinal = (matches || [])
                .filter((m: any) => m.is_grand_final && m.state === 'COMPLETE' && !m.scores_csv?.includes('Cancelled') && !m.scores_csv?.includes('BYE'))
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

                let currentRank = 3;

                if (isDoubleElim) {
                    const losersByLBRound = new Map<number, Set<string>>();
                    matches.filter((m: any) => m.state === 'COMPLETE' && m.round < 0).forEach((m: any) => {
                        const lId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id;
                        if (lId) {
                            const absR = Math.abs(m.round);
                            if (!losersByLBRound.has(absR)) losersByLBRound.set(absR, new Set());
                            losersByLBRound.get(absR)!.add(lId);
                        }
                    });

                    const lbRounds = Array.from(losersByLBRound.keys()).sort((a, b) => b - a);
                    lbRounds.forEach(r => {
                        const playersInThisRound = Array.from(losersByLBRound.get(r)!)
                            .filter(id => !processedIds.has(id))
                            .sort(getTieBreakerSort);

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
                        const playersInThisRound = Array.from(losersByWbRound.get(r)!)
                            .filter(id => !processedIds.has(id))
                            .sort(getTieBreakerSort);

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

            // Fallback for anyone else who registered but didn't play or was not captured
            const remainingPlayers = Array.from(playerMap.keys())
                .filter(id => !processedIds.has(id))
                .sort(getTieBreakerSort);
            
            remainingPlayers.forEach(id => {
                standings.push({ id, rank: standings.length + 1, name: playerMap.get(id) || 'Unknown' });
            });

            // Fallback for others or for non-Double brackets: sort by round of exit
            // (Excluded for brevity, usually enough for top 3)

            return NextResponse.json({ success: true, data: standings });
        }

        if (!tournament.challonge_url) {
            return NextResponse.json({ success: false, message: "Tournament not linked to Challonge" }, { status: 404 });
        }

        // Verify Ownership
        if (tournament.user_id && tournament.user_id !== userId) {
            return NextResponse.json({ success: false, message: "Unauthorized access to tournament" }, { status: 403 });
        }

        const challongeUrl = tournament.challonge_url as string;
        const identifier = challongeUrl.split('/').pop();
        if (!identifier) {
            return NextResponse.json({ success: false, message: "Invalid Challonge URL" }, { status: 400 });
        }

        const apiKey = await getUserApiKey(userId);
        if (!apiKey) throw new Error("Challonge API Key not found for user");

        const standings = await getTournamentStandings(apiKey, identifier);
        return NextResponse.json({ success: true, data: standings });

    } catch (error: any) {
        console.error("GET Standings Error:", error);
        const errorDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        return NextResponse.json({
            success: false,
            message: error.message,
            details: errorDetail
        }, { status: 500 });
    }
}
