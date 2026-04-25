import { NextResponse } from "next/server";
import { getParticipantOrder, setParticipantOrder } from "@/lib/repository";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tournamentId = searchParams.get("tournamentId");
        if (!tournamentId) throw new Error("Tournament ID is required");

        const order = await getParticipantOrder(tournamentId);
        return NextResponse.json({ success: true, order });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!body.tournamentId || !body.order) throw new Error("Tournament ID and Order are required");

        await setParticipantOrder(body.tournamentId, body.order);
        return NextResponse.json({ success: true, message: "Order saved successfully" });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
