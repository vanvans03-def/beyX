import { NextResponse } from "next/server";
import { getRegistrations, deleteRegistration, createRegistration, getTournament } from "@/lib/repository";
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get("tournamentId") || undefined;

    try {

        if (!tournamentId) {
            return NextResponse.json({ success: true, data: [] });
        }

        // Resolve ID to actual UUID if it's a name
        const tournament = await getTournament(tournamentId);
        const actualId = tournament?.id || tournamentId;

        // Disable cache
        const data = await getRegistrations(actualId);

        // Map to Frontend expected format (PascalCase from Sheets)
        // Repo: id, tournament_id, player_name, device_uuid, mode, main_deck, reserve_decks, timestamp
        // Sheets: TournamentID, RoundID, Timestamp, DeviceUUID, PlayerName, Mode, Main_Bey1...
        const mapped = data.map(r => ({
            tournament_id: r.tournament_id,
            id: r.id, 
            timestamp: (r.timestamp && !isNaN(r.timestamp.getTime())) ? r.timestamp.toISOString() : new Date().toISOString(),
            device_uuid: r.device_uuid,
            player_name: r.player_name,
            mode: r.mode === 'Under10South' ? 'Under10Custom' : r.mode,
            main_bey1: r.main_deck[0] || "",
            main_bey2: r.main_deck[1] || "",
            main_bey3: r.main_deck[2] || "",
            total_points: r.total_points
        }));

        return NextResponse.json({ success: true, data: mapped }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });
    } catch (error: unknown) {
        console.error("Admin Registrations GET Error:", {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            tournamentId
        });
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { tournamentId, players, mode } = body;

        if (!tournamentId || !players || !Array.isArray(players) || players.length === 0) {
            return NextResponse.json({ success: false, message: "Invalid Request" }, { status: 400 });
        }

        const trimmedPlayers = players
            .map((p: string) => p.trim())
            .filter((p: string) => p);

        if (trimmedPlayers.length === 0) {
            return NextResponse.json({ success: false, message: "No valid player names" }, { status: 400 });
        }

        // 1. Check for Internal Duplicates in the batch
        const uniqueInput = new Set<string>();
        const internalDuplicates = new Set<string>();

        trimmedPlayers.forEach((p: string) => {
            const lower = p.toLowerCase();
            if (uniqueInput.has(lower)) {
                internalDuplicates.add(p);
            }
            uniqueInput.add(lower);
        });

        // 2. Check for Database Duplicates
        const registrations = await getRegistrations(tournamentId);
        const existingNames = new Set(registrations.map(r => r.player_name.toLowerCase()));

        const dbConflicts: string[] = [];

        trimmedPlayers.forEach((p: string) => {
            if (existingNames.has(p.toLowerCase())) {
                dbConflicts.push(p);
            }
        });

        // 3. Return Errors if any conflicts found
        if (dbConflicts.length > 0) {
            return NextResponse.json({
                success: false,
                message: `Found ${dbConflicts.length} duplicate names already registered.`,
                details: {
                    conflicts: dbConflicts,
                    internal: Array.from(internalDuplicates)
                }
            }, { status: 400 });
        }

        if (internalDuplicates.size > 0) {
            return NextResponse.json({
                success: false,
                message: `Found duplicate names in your list.`,
                details: {
                    conflicts: [],
                    internal: Array.from(internalDuplicates)
                }
            }, { status: 400 });
        }

                // 4. Proceed to Bulk Insert (We know they are unique now)
        for (const playerName of trimmedPlayers) {
            const deviceUuid = `admin-manual-${uuidv4().substring(0, 8)}`;
            // Basic create without re-checking since we just checked
            await createRegistration({
                tournament_id: tournamentId,
                player_name: playerName,
                device_uuid: deviceUuid,
                mode: mode || "Open",
                main_deck: []
            });
        }

        return NextResponse.json({ success: true, message: `Registered ${trimmedPlayers.length} players successfully` });
    } catch (error: unknown) {
        console.error("Bulk Registration Error:", error);
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const body = await req.json();
        if (!body.id) throw new Error("ID is required");

        await deleteRegistration(body.id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { id, player_name } = body;

        if (!id || !player_name || !player_name.trim()) {
            return NextResponse.json({ success: false, message: "ID and player name are required" }, { status: 400 });
        }

        const trimmedName = player_name.trim();

        // 1. Fetch current registration to find the tournamentId
        const { data: reg, error: fetchErr } = await supabaseAdmin
            .from('registrations')
            .select('tournament_id')
            .eq('id', id)
            .single();

        if (fetchErr || !reg) {
            return NextResponse.json({ success: false, message: "Registration not found" }, { status: 404 });
        }

        // 2. Fetch all other registrations for the same tournament to check for duplicates
        const { data: existingRegs, error: fetchAllErr } = await supabaseAdmin
            .from('registrations')
            .select('id, player_name')
            .eq('tournament_id', reg.tournament_id);

        if (fetchAllErr) throw fetchAllErr;

        const isDuplicate = existingRegs?.some(
            r => r.id !== id && r.player_name.trim().toLowerCase() === trimmedName.toLowerCase()
        );

        if (isDuplicate) {
            return NextResponse.json({ success: false, message: "ชื่อผู้เล่นนี้ถูกลงทะเบียนในทัวร์นาเมนต์นี้ไปแล้ว" }, { status: 400 });
        }

        // 3. Update the name
        const { error } = await supabaseAdmin
            .from('registrations')
            .update({ player_name: trimmedName })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Admin Registration PATCH Error:", error);
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
