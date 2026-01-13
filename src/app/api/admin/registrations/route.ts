import { NextResponse } from "next/server";
import { getRegistrations, deleteRegistration } from "@/lib/repository";

export const dynamic = 'force-dynamic';

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
