import { NextResponse } from "next/server";
import { getRegistrations, deleteRegistration, createRegistration, getTournament } from "@/lib/repository";
import { v4 as uuidv4 } from 'uuid';

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
            mode: r.mode,
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
    } catch (error: any) {
        console.error("Admin Registrations GET Error:", {
            message: error.message,
            stack: error.stack,
            tournamentId
        });
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
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
        const promises = trimmedPlayers.map(async (playerName: string) => {
            const deviceUuid = `admin-manual-${uuidv4().substring(0, 8)}`;
            // Basic create without re-checking since we just checked
            await createRegistration({
                tournament_id: tournamentId,
                player_name: playerName,
                device_uuid: deviceUuid,
                mode: mode || "Open",
                main_deck: []
            });
        });

        await Promise.all(promises);

        return NextResponse.json({ success: true, message: `Registered ${trimmedPlayers.length} players successfully` });
    } catch (error: any) {
        console.error("Bulk Registration Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const body = await req.json();
        if (!body.id) throw new Error("ID is required");

        await deleteRegistration(body.id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
