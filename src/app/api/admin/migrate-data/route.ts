import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import * as sheets from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('key') !== 'MIGRATE_NOW') {
        return NextResponse.json({ error: "Unauthorized. Add ?key=MIGRATE_NOW" }, { status: 401 });
    }

    // Ensure we have admin rights for migration
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Supabase Service Role Key missing" }, { status: 500 });
    }

    try {
        // 1. Tournaments
        const tournaments = await sheets.getTournaments();
        let tCount = 0;
        for (const t of tournaments) {
            const { error } = await supabaseAdmin
                .from('tournaments')
                .upsert({
                    id: t.TournamentID, // Assume valid UUIDs in sheets or supabase auto-gen if needed. Wait, we need consistency. If sheets has legacy IDs, this might fail uuid check.
                    // Risk: Sheets might have non-UUID IDs if manually edited? 
                    // Let's assume they are valid UUIDs from previous system logic.
                    // Upsert helps prevent duplicates.
                    name: t.Name,
                    status: t.Status,
                    created_at: t.CreatedAt
                }, { onConflict: 'id' });

            if (!error) tCount++;
            else console.log("Tournament migrate error:", error.message);
        }

        // 2. Registrations
        const registrations = await sheets.getRegistrations();
        let rCount = 0;
        let skipped = 0;

        for (const r of registrations) {
            // Skip legacy without real TournamentID or ensure Tournament exists? 
            // Supabase FK will block if TournamentID is invalid.
            try {
                // Reserve Data Parsing
                let reserveData = [];
                try {
                    reserveData = JSON.parse(r.Reserve_Data);
                } catch {
                    reserveData = [];
                }

                const payload = {
                    id: r.RoundID,
                    tournament_id: r.TournamentID,
                    player_name: r.PlayerName,
                    device_uuid: r.DeviceUUID,
                    mode: r.Mode,
                    main_deck: [r.Main_Bey1, r.Main_Bey2, r.Main_Bey3],
                    reserve_decks: reserveData,
                    timestamp: r.Timestamp
                };

                const { error } = await supabaseAdmin
                    .from('registrations')
                    .upsert(payload, { onConflict: 'id' });

                if (!error) {
                    rCount++;
                } else {
                    console.warn(`Skipping Registration ${r.RoundID}:`, error.message);
                    skipped++;
                }

            } catch (e: any) {
                console.warn("Parse Error:", e.message);
                skipped++;
            }
        }

        return NextResponse.json({
            success: true,
            migrated: {
                tournaments: tCount,
                registrations: rCount,
                skipped_registrations: skipped
            }
        });

    } catch (error: any) {
        console.error("Migration Failed:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
