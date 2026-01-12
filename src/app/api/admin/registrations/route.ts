import { NextResponse } from "next/server";
import { getRegistrations, deleteRegistration } from "@/lib/sheets";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tournamentId = searchParams.get("tournamentId") || undefined;

        // Disable cache
        const data = await getRegistrations(tournamentId);
        return NextResponse.json({ success: true, data }, {
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
