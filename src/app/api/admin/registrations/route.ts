import { NextResponse } from "next/server";
import { getRegistrations, deleteRegistration, createRegistration } from "@/lib/repository";
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tournamentId = searchParams.get("tournamentId") || undefined;

        if (!tournamentId) {
            return NextResponse.json({ success: true, data: [] });
        }

        // Disable cache
        const data = await getRegistrations(tournamentId);

        // Map to Frontend expected format (PascalCase from Sheets)
        // Repo: id, tournament_id, player_name, device_uuid, mode, main_deck, reserve_decks, timestamp
        // Sheets: TournamentID, RoundID, Timestamp, DeviceUUID, PlayerName, Mode, Main_Bey1...
        const mapped = data.map(r => ({
            TournamentID: r.tournament_id,
            RoundID: r.id, // Using Postgres ID as RoundID
            Timestamp: r.timestamp.toISOString(),
            DeviceUUID: r.device_uuid,
            PlayerName: r.player_name,
            Mode: r.mode,
            Main_Bey1: r.main_deck[0] || "",
            Main_Bey2: r.main_deck[1] || "",
            Main_Bey3: r.main_deck[2] || "",
            TotalPoints: "0",
            Reserve_Data: JSON.stringify(r.reserve_decks)
        }));

        return NextResponse.json({ success: true, data: mapped }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });
    } catch (error: any) {
        console.error("Admin Fetch Error:", error);
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
        const deviceUuid = `admin-manual-${uuidv4().substring(0, 8)}`;

        const promises = trimmedPlayers.map(async (playerName: string) => {
            // Basic create without re-checking since we just checked
            await createRegistration({
                tournament_id: tournamentId,
                player_name: playerName,
                device_uuid: deviceUuid,
                mode: mode || "Open",
                main_deck: [],
                reserve_decks: []
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
        if (!body.roundId) throw new Error("RoundID is required");

        await deleteRegistration(body.roundId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
