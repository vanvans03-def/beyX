import { NextResponse } from "next/server";
import { createTournament, getTournaments, getTournament, updateTournamentStatus, getUserApiKey } from "@/lib/repository";
import { finalizeTournament } from "@/lib/challonge";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (id) {
            // Fetch single
            const data = await getTournament(id);
            if (!data) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

            // Verify Ownership
            if (data.user_id && data.user_id !== userId) {
                return NextResponse.json({ success: false, message: "Unauthorized access to tournament" }, { status: 403 });
            }

            const mapped = {
                TournamentID: data.id,
                Name: data.name,
                Status: data.status,
                CreatedAt: data.created_at.toISOString(),
                Type: data.type,
                BanList: data.ban_list,
                ChallongeUrl: data.challonge_url,
                ArenaCount: data.arena_count || 0
            };
            return NextResponse.json({ success: true, data: mapped });
        } else {
            // Fetch all for current user
            const data = await getTournaments(userId);
            const mapped = data.map(d => ({
                TournamentID: d.id,
                Name: d.name,
                Status: d.status,
                CreatedAt: d.created_at.toISOString(),
                Type: d.type,
                BanList: d.ban_list,
                ChallongeUrl: d.challonge_url,
                ArenaCount: d.arena_count || 0
            }));
            return NextResponse.json({ success: true, data: mapped });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        if (!body.name) throw new Error("Name is required");

        console.log('[DEBUG] Creating tournament with type:', body.type);
        const newT = await createTournament(body.name, userId, body.type, body.ban_list);
        // Map back to PascalCase
        const mapped = {
            TournamentID: newT.id,
            Name: newT.name,
            Status: newT.status,
            CreatedAt: newT.created_at.toISOString(),
            Type: newT.type,
            BanList: newT.ban_list,
            ChallongeUrl: newT.challonge_url
        };
        return NextResponse.json({ success: true, data: mapped });
    } catch (e: any) {
        console.error("[API] POST Tournament Failed:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        if (!body.tournamentId || !body.status) throw new Error("ID and Status required");

        // Verify Ownership
        const tournament = await getTournament(body.tournamentId);
        if (!tournament) throw new Error("Tournament not found");
        if (tournament.user_id && tournament.user_id !== userId) {
            return NextResponse.json({ success: false, message: "Unauthorized access to tournament" }, { status: 403 });
        }

        if (body.status === 'CLOSED') {
            // Check if there is a Challonge URL associated
            if (tournament?.challonge_url) {
                // Extract identifier: https://challonge.com/bb_123 -> bb_123
                const identifier = tournament.challonge_url.split('/').pop();
                if (identifier) {
                    try {
                        const apiKey = await getUserApiKey(userId);
                        if (!apiKey) throw new Error("Challonge API Key not found for user");

                        await finalizeTournament(apiKey, identifier);
                    } catch (err: any) {
                        console.error('Challonge Finalize Error:', err.response?.data || err.message);
                        // If it's 422, it might be open matches or already finalized
                        if (err.response?.status === 422) {
                            const challongeErrors = err.response?.data?.errors;
                            if (challongeErrors) {
                                // Check if it's just "already finalized"
                                const isAlreadyDone = challongeErrors.some((e: string) =>
                                    (typeof e === 'string') && (e.toLowerCase().includes('complete') || e.toLowerCase().includes('finalized'))
                                );

                                if (isAlreadyDone) {
                                    console.log('Tournament already finalized on Challonge, proceeding to update local status.');
                                    // Swallow error to allow local DB update
                                } else {
                                    throw new Error(`Challonge Error: ${challongeErrors.join(', ')}`);
                                }
                            }
                        } else {
                            throw err; // Re-throw other errors
                        }
                    }
                }
            }
        }

        await updateTournamentStatus(body.tournamentId, body.status);
        return NextResponse.json({ success: true, data: { status: body.status } });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
