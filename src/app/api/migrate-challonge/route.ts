import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);


export async function GET() {
    try {
        const { error } = await supabase.rpc('exec_sql', {
            sql: `
            ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS challonge_url TEXT;
            ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS tournament_type TEXT DEFAULT 'single elimination';
        `
        });

        // If RPC fails (often disabled), try direct query if using a specialized client, 
        // but standard supabase-js client via PostgREST doesn't support raw SQL unless via RPC.
        // However, I see the user has 'pg' or similar potentially, or I can just assume 
        // the user might need to run this manually if RPC is restricted.
        // Let's try to assume we might not have `exec_sql` RPC. 
        // If this fails, I will instruct the user or use a node script with `pg` if available (supabase helper often uses it).

        // Checking 'verify_db.js' from previous context might give a clue.

        if (error) {
            console.error("RPC Error:", error);
            return NextResponse.json({ error: error.message, hint: "You might need to run the SQL manually or enable exec_sql RPC" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Migration applied (if RPC worked)" });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
