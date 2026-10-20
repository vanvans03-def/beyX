import { NextResponse } from "next/server";
import { getParticipantOrder, setParticipantOrder, deleteParticipantOrder } from "@/lib/repository";
import { requireTournamentOwner } from '@/lib/tournament-access';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tournamentId = searchParams.get("tournamentId");
        if (!tournamentId) throw new Error("Tournament ID is required");

        const ownershipError = await requireTournamentOwner(req, tournamentId);
        if (ownershipError) return ownershipError;

        const order = await getParticipantOrder(tournamentId);
        return NextResponse.json({ success: true, order });
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!body.tournamentId || !body.order) throw new Error("Tournament ID and Order are required");

        const ownershipError = await requireTournamentOwner(req, body.tournamentId);
        if (ownershipError) return ownershipError;

        await setParticipantOrder(body.tournamentId, body.order);
        return NextResponse.json({ success: true, message: "Order saved successfully" });
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tournamentId = searchParams.get("tournamentId");
        if (!tournamentId) throw new Error("Tournament ID is required");

        const ownershipError = await requireTournamentOwner(req, tournamentId);
        if (ownershipError) return ownershipError;

        await deleteParticipantOrder(tournamentId);
        return NextResponse.json({ success: true, message: "Order reset successfully" });
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
