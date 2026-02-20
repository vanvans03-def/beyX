import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin Client (Service Role)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create client with service key to bypass RLS for admin writes
const supabase = createClient(supabaseUrl, supabaseServiceKey);


export async function POST(req: Request) {
    try {
        console.log("Receiving Challonge Webhook...");
        const text = await req.text();
        const params = new URLSearchParams(text);

        // Extract Challonge Payload
        // Field names are usually 'match[id]', 'match[state]', etc.
        const matchId = params.get('match[id]');
        const state = params.get('match[state]');
        const winnerId = params.get('match[winner_id]');
        const scoresCsv = params.get('match[scores_csv]');
        const tournamentId = params.get('tournament[id]');

        if (matchId) {
            console.log(`Processing match update: ${matchId} (State: ${state})`);

            // Check if tournamentId is available if we want to filter or store it
            // upsert into 'matches' table
            const { error } = await supabase.from('matches').upsert({
                id: parseInt(matchId),
                state: state,
                winner_id: winnerId ? parseInt(winnerId) : null,
                score_csv: scoresCsv,
                tournament_id: tournamentId ? parseInt(tournamentId) : 0, // Fallback if missing, but usually present in context
                updated_at: new Date().toISOString()
            });

            if (error) {
                console.error("Supabase Error:", error);
                return new NextResponse('Database Error', { status: 500 });
            }
        } else {
            console.log("No match ID found in payload");
        }

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error("Webhook Error:", err);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
