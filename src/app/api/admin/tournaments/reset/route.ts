import { NextResponse } from "next/server";
import { resetTournamentBracket } from "@/lib/repository";

export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!body.tournamentId) throw new Error("Tournament ID is required");

        await resetTournamentBracket(body.tournamentId);
        return NextResponse.json({ success: true, message: "Tournament reset successfully" });
    } catch (e: any) {
        console.error("[API] Reset Tournament Failed:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
