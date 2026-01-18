
import { NextResponse } from "next/server";
import { getTournament } from "@/lib/repository";
import { getTournamentStandings } from "@/lib/challonge";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const tournament = await getTournament(id);

        if (!tournament || !tournament.challonge_url) {
            return NextResponse.json({ success: false, message: "Tournament not linked to Challonge" }, { status: 404 });
        }

        const identifier = tournament.challonge_url.split('/').pop();
        if (!identifier) {
            return NextResponse.json({ success: false, message: "Invalid Challonge URL" }, { status: 400 });
        }

        const standings = await getTournamentStandings(identifier);
        return NextResponse.json({ success: true, data: standings });

    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
