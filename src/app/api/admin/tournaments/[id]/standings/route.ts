
import { NextResponse } from "next/server";
import { getTournament, getUserApiKey } from "@/lib/repository";
import { getTournamentStandings } from "@/lib/challonge";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const tournament = await getTournament(id);

        if (!tournament || !tournament.challonge_url) {
            return NextResponse.json({ success: false, message: "Tournament not linked to Challonge" }, { status: 404 });
        }

        // Verify Ownership
        if (tournament.user_id && tournament.user_id !== userId) {
            return NextResponse.json({ success: false, message: "Unauthorized access to tournament" }, { status: 403 });
        }

        const identifier = tournament.challonge_url.split('/').pop();
        if (!identifier) {
            return NextResponse.json({ success: false, message: "Invalid Challonge URL" }, { status: 400 });
        }

        const apiKey = await getUserApiKey(userId);
        if (!apiKey) throw new Error("Challonge API Key not found for user");

        const standings = await getTournamentStandings(apiKey, identifier);
        return NextResponse.json({ success: true, data: standings });

    } catch (error: any) {
        console.error("GET Standings Error:", error);
        const errorDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        return NextResponse.json({
            success: false,
            message: error.message,
            details: errorDetail
        }, { status: 500 });
    }
}
