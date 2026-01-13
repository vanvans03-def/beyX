import { NextResponse } from "next/server";
import { createTournament, getTournaments, getTournament, updateTournamentStatus } from "@/lib/repository";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (id) {
            // Fetch single
            const data = await getTournament(id);
            if (!data) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

            const mapped = {
                TournamentID: data.id,
                Name: data.name,
                Status: data.status,
                CreatedAt: data.created_at.toISOString(),
                Type: data.type,
                BanList: data.ban_list
            };
            return NextResponse.json({ success: true, data: mapped });
        } else {
            // Fetch all
            const data = await getTournaments();
            const mapped = data.map(d => ({
                TournamentID: d.id,
                Name: d.name,
                Status: d.status,
                CreatedAt: d.created_at.toISOString(),
                Type: d.type,
                BanList: d.ban_list
            }));
            return NextResponse.json({ success: true, data: mapped });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!body.name) throw new Error("Name is required");

        const newT = await createTournament(body.name, body.type, body.ban_list);
        // Map back to PascalCase
        const mapped = {
            TournamentID: newT.id,
            Name: newT.name,
            Status: newT.status,
            CreatedAt: newT.created_at.toISOString(),
            Type: newT.type,
            BanList: newT.ban_list
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
