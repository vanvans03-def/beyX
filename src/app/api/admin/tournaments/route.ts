import { NextResponse } from "next/server";
import { createTournament, getTournaments, updateTournamentStatus } from "@/lib/repository";

export async function GET() {
    try {
        const data = await getTournaments();
        // Repository returns clean object, no need for major transformation but let's ensure field casing consistency if frontend relies on it
        // Frontend expects: TournamentID, Name, Status, CreatedAt (PascalCase from Sheets usually)
        // Repository returns: id, name, status, created_at (snake_case from Postgres)
        // We need to map it back to PascalCase to avoid breaking frontend
        const mapped = data.map(d => ({
            TournamentID: d.id,
            Name: d.name,
            Status: d.status,
            CreatedAt: d.created_at.toISOString()
        }));
        return NextResponse.json({ success: true, data: mapped });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!body.name) throw new Error("Name is required");

        const newT = await createTournament(body.name);
        // Map back to PascalCase
        const mapped = {
            TournamentID: newT.id,
            Name: newT.name,
            Status: newT.status,
            CreatedAt: newT.created_at.toISOString()
        };
        return NextResponse.json({ success: true, data: mapped });
    } catch (e: any) {
        console.error("[API] POST Tournament Failed:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        if (!body.tournamentId || !body.status) throw new Error("ID and Status required");

        await updateTournamentStatus(body.tournamentId, body.status);
        return NextResponse.json({ success: true, data: { status: body.status } });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
