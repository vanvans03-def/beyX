import { NextResponse } from "next/server";


export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("key") !== "MIGRATE_EVENTS") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
        { error: 'Retired endpoint: database schema changes must run through reviewed migration files.' },
        { status: 410 },
    );
}
