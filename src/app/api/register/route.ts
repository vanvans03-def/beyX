import { NextResponse } from "next/server";
import { createRegistration } from "@/lib/repository";
import gameData from "@/data/game-data.json";
import { supabaseAdmin } from "@/lib/supabase";

// Validation Logic (Duplicated from Frontend for security, usually shared via lib/types but keeping simple here)
function validatePayload(body: any) {
    const { playerName, mode, mainBeys, totalPoints } = body;
    if (!playerName || !mode || !Array.isArray(mainBeys) || mainBeys.length !== 3) {
        return { valid: false, message: "Invalid payload structure" };
    }

    // Check Bans if NoMoreMeta
    if (mode === "NoMoreMeta") {
        const banned = mainBeys.filter((name: string) => gameData.banList.includes(name));
        if (banned.length > 0) {
            return { valid: false, message: `Contains Banned Beys: ${banned.join(", ")}` };
        }
    }

    // Check Points if Under10
    if (mode === "Under10") {
        // Re-calculate points to be sure
        const pointsMap: Record<string, number> = {};
        Object.entries(gameData.points).forEach(([pt, names]) => {
            names.forEach(name => pointsMap[name] = parseInt(pt));
        });

        const calculatedPoints = mainBeys.reduce((sum: number, name: string) => sum + (pointsMap[name] || 0), 0);
        if (calculatedPoints > 10) {
            return { valid: false, message: `Total Points ${calculatedPoints} exceeds limit.` };
        }
    }

    return { valid: true };
}

// Retry Helper
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0) {
            // Check for Rate Limit (429) or Server Error (5xx)
            // Google Sheets API errors: 429 = RESOURCE_EXHAUSTED
            const isRateLimit = error.response?.status === 429 || error.code === 429 || error.message?.includes("429");
            const isServerErr = error.response?.status >= 500;

            if (isRateLimit || isServerErr) {
                console.warn(`API Error ${error.code || error.response?.status}, Retrying in ${delay}ms... (${retries} left)`);
                await new Promise(r => setTimeout(r, delay));
                return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
            }
        }
        throw error;
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 1. Validate
        const uniqueMain = new Set(body.mainBeys);
        if ((uniqueMain.size !== 3) && body.mode !== "Unlimited") { // Basic uniqueness check
            // Actually Frontend enforces 3 unique. Server should too.
            if (uniqueMain.size !== 3) {
                return NextResponse.json({ success: false, message: "Main Deck must use 3 unique Blades." }, { status: 400 });
            }
        }

        const validation = validatePayload(body);
        if (!validation.valid) {
            return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
        }

        // 2. Prepare Data
        // Column Mapping: RoundID    const { 
        const {
            deviceUUID,
            playerName,
            mode,
            mainBeys,
            reserveDecks, // Changed from reserveBeys
            totalPoints,
            tournamentId
        } = body;

        if (!tournamentId) throw new Error("Missing Tournament ID");

        // Server-side validation
        // Fetch Tournament Status to prevent race conditions
        const { data: tournament, error: tournamentError } = await supabaseAdmin
            .from('tournaments')
            .select('status, challonge_url')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return NextResponse.json({ success: false, message: "Tournament not found" }, { status: 404 });
        }

        if (tournament.status === 'STARTED' || tournament.status === 'COMPLETED' || tournament.status === 'CLOSED' || !!tournament.challonge_url) {
            return NextResponse.json({ success: false, message: "ไม่สามารถลงทะเบียนได้ การแข่งเริ่มไปแล้ว" }, { status: 400 });
        }

        const registrationData = {
            tournament_id: tournamentId,
            player_name: playerName,
            device_uuid: deviceUUID,
            mode: mode,
            main_deck: [mainBeys[0], mainBeys[1], mainBeys[2]],
            reserve_decks: reserveDecks || []
        };

        // repository.createRegistration handles dual write (Postgres + Sheets)
        await withRetry(() => createRegistration(registrationData));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Registration Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');
    const deviceUUID = searchParams.get('deviceUUID');
    const checkName = searchParams.get('checkName');
    const listPlayers = searchParams.get('listPlayers');

    if (!tournamentId) {
        return NextResponse.json({ success: false, message: "Missing Tournament ID" }, { status: 400 });
    }

    try {
        if (listPlayers) {
            const { data, error } = await supabaseAdmin
                .from('registrations')
                .select('player_name')
                .eq('tournament_id', tournamentId)
                .order('player_name', { ascending: true });

            if (error) throw error;
            return NextResponse.json({
                success: true,
                players: data.map((d: any) => d.player_name)
            });
        }

        if (checkName) {
            const { data, error } = await supabaseAdmin
                .from('registrations')
                .select('id')
                .eq('tournament_id', tournamentId)
                .ilike('player_name', checkName) // Case insensitive check
                .limit(1);

            if (error) throw error;
            return NextResponse.json({ exists: data && data.length > 0 });
        }

        if (deviceUUID) {
            const { data, error } = await supabaseAdmin
                .from('registrations')
                .select('*')
                .eq('tournament_id', tournamentId)
                .eq('device_uuid', deviceUUID)
                .order('timestamp', { ascending: true }); // Show oldest first (Player 1, 2, 3...)

            if (error) throw error;

            return NextResponse.json({ success: true, data: data });
        }

        return NextResponse.json({ success: false, message: "Invalid parameters" }, { status: 400 });

    } catch (error: any) {
        console.error("GET Registration Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
