import { NextResponse } from "next/server";
import { createTournament, getTournaments, getTournament, updateTournamentStatus, getUserApiKey } from "@/lib/repository";
import { finalizeTournament } from "@/lib/challonge";
import { supabaseAdmin } from "@/lib/supabase";

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

            // Fetch owner's cx_enabled setting
            const { data: ownerUser } = await supabaseAdmin
                .from('users')
                .select('cx_enabled')
                .eq('id', data.user_id)
                .single();

            const mapped = {
                id: data.id,
                name: data.name,
                status: data.status,
                created_at: data.created_at.toISOString(),
                type: data.type,
                ban_list: data.ban_list,
                BanList: data.ban_list, // Backwards compatibility mapping
                challonge_url: data.challonge_url,
                arena_count: data.arena_count || 0,
                provider: data.provider || 'CHALLONGE',
                bracket_type: data.bracket_type || 'SINGLE',
                cx_enabled: ownerUser?.cx_enabled ?? true
            };
            return NextResponse.json({ success: true, data: mapped });
        } else {
            // Fetch all for current user
            const data = await getTournaments(userId);
            const mapped = data.map(d => ({
                id: d.id,
                name: d.name,
                status: d.status,
                created_at: d.created_at.toISOString(),
                type: d.type,
                ban_list: d.ban_list,
                BanList: d.ban_list, // Backwards compatibility mapping
                challonge_url: d.challonge_url,
                arena_count: d.arena_count || 0,
                provider: d.provider || 'CHALLONGE',
                bracket_type: d.bracket_type || 'SINGLE'
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

        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('event_mode_enabled, role')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return NextResponse.json({ success: false, error: "Failed to verify account permissions." }, { status: 500 });
        }

        if (user.role !== 'superadmin' && user.event_mode_enabled === false) {
            return NextResponse.json({ success: false, error: "ฟังก์ชันการสร้างทัวร์นาเมนต์ถูกปิดใช้งานโดย Super Admin" }, { status: 403 });
        }

        const body = await req.json();
        if (!body.name) throw new Error("Name is required");

        console.log('[DEBUG] Creating tournament with type:', body.type);
        const newT = await createTournament(
            body.name, 
            userId, 
            body.type, 
            body.ban_list,
            body.provider || 'CHALLONGE',
            body.bracket_type || 'SINGLE'
        );
        // Map back to PascalCase
        const mapped = {
            id: newT.id,
            name: newT.name,
            status: newT.status,
            created_at: newT.created_at.toISOString(),
            type: newT.type,
            ban_list: newT.ban_list,
            BanList: newT.ban_list, // Compatibility mapping
            challonge_url: newT.challonge_url,
            provider: newT.provider,
            bracket_type: newT.bracket_type
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
        if (!body.tournamentId) throw new Error("Tournament ID required");

        // Handle bracket_type or arena_count updates standalone
        if ((body.bracket_type || body.arena_count !== undefined) && !body.status) {
            const { createClient } = await import('@supabase/supabase-js');
            const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
            
            const updateFields: any = {};
            if (body.bracket_type) updateFields.bracket_type = body.bracket_type;
            if (body.arena_count !== undefined) updateFields.arena_count = body.arena_count;
            
            const { error } = await sb.from('tournaments').update(updateFields).eq('id', body.tournamentId);
            if (error) throw new Error(error.message);
            return NextResponse.json({ success: true, data: updateFields });
        }

        if (!body.status) throw new Error("Status required");

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
