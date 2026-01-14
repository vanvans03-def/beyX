import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("key") !== "MIGRATE_EVENTS") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Attempt 1: Try using RPC if 'exec_sql' function exists (common in some starter kits)
        const sql = `
            CREATE TABLE IF NOT EXISTS events (
                id UUID PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                event_date TIMESTAMPTZ NOT NULL,
                location TEXT,
                map_link TEXT,
                facebook_link TEXT,
                image_url TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `;

        const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error("RPC Migration Failed:", error);
            // Return instructions if automatic fails
            return NextResponse.json({
                success: false,
                message: "Automatic migration failed. Please run the following SQL in your Supabase SQL Editor:",
                sql: sql
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Events table created successfully via RPC." });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
