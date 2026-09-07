import { NextResponse } from 'next/server';
import { adminDb as supabaseAdmin } from '@/lib/db/admin';
import { getCachedData, setCachedData, singleFlight } from '@/lib/redis';

export const dynamic = 'force-dynamic';

class RegistrationConfigError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
        return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 });
    }

    try {
        const cacheKey = `register:config:${tournamentId}`;
        const cachedResponse = await getCachedData<any>(cacheKey);
        if (cachedResponse) {
            return NextResponse.json(cachedResponse);
        }
        const responseData = await singleFlight(cacheKey, async () => {
            const filled = await getCachedData<any>(cacheKey);
            if (filled) return filled;

            // Fetch tournament to find its user_id and tournament format type.
            let query = supabaseAdmin.from('tournaments').select('user_id, ban_list, type');
            const looksLikeUUID = tournamentId.includes('-') || (tournamentId.length === 36 || tournamentId.length === 32);
            query = looksLikeUUID ? query.eq('id', tournamentId) : query.ilike('name', tournamentId);

            const { data: tournament, error: tErr } = await query.maybeSingle();
            if (tErr || !tournament) throw new RegistrationConfigError("Tournament not found", 404);

            const userId = tournament.user_id;
            const isCustomPointMode = tournament.type === 'U10Custom';
            const [{ data: user }, { data: beyblades, error: bErr }, { data: overrides, error: oErr }] = await Promise.all([
                supabaseAdmin.from('users').select('cx_enabled').eq('id', userId).single(),
                supabaseAdmin.from('beyblades').select('*'),
                supabaseAdmin.from('user_beyblade_points').select('*').eq('user_id', userId),
            ]);
            if (bErr) throw bErr;
            if (oErr) throw oErr;

            const overrideByBeyId = new Map((overrides || []).map((override: any) => [override.beyblade_id, override]));
            const resolved = (beyblades || []).map((b: any) => {
                const override: any = overrideByBeyId.get(b.id);
                return {
                    name: b.name,
                    image_url: b.image_url,
                    type: b.type || 'BX',
                    points_standard: isCustomPointMode && override?.points_standard != null
                        ? override.points_standard
                        : b.points_standard,
                    is_banned: override?.is_banned != null ? override.is_banned : b.is_banned,
                };
            });
            const result = {
                success: true,
                beyblades: resolved,
                banList: resolved.filter((b: any) => b.is_banned).map((b: any) => b.name),
                cxEnabled: user?.cx_enabled ?? true,
            };
            await setCachedData(cacheKey, result, 3600);
            return result;
        });

        return NextResponse.json(responseData);
    } catch (e: any) {
        console.error("GET register config error:", e);
        return NextResponse.json(
            { error: e.message },
            { status: e instanceof RegistrationConfigError ? e.status : 500 },
        );
    }
}
