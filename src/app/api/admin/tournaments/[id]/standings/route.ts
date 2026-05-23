
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

            const playedWbMatches = (matches || [])
                .filter((m: any) => m.round > 0 && m.state === 'COMPLETE' && !m.scores_csv?.includes('Cancelled'))
                .sort((a: any, b: any) => b.round - a.round);
            const finalMatch = playedWbMatches[0];

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
                    matches.filter((m: any) => m.state === 'COMPLETE').forEach((m: any) => {
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
