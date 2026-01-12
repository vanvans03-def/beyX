import { NextResponse } from "next/server";
import { createTournament, getTournaments, updateTournamentStatus } from "@/lib/sheets";

export async function GET() {
    try {
        const data = await getTournaments();
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!body.name) throw new Error("Name is required");

        const newTournament = await createTournament(body.name);
        return NextResponse.json({ success: true, data: newTournament });
    } catch (e: any) {
        console.error("[API] POST Tournament Failed:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        if (!body.tournamentId || !body.status) throw new Error("ID and Status required");

        const updated = await updateTournamentStatus(body.tournamentId, body.status);
        return NextResponse.json({ success: true, data: updated });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
