import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/db/admin';
import { getCachedData, setCachedData, singleFlight } from '@/lib/redis';

export const dynamic = 'force-dynamic';

type PublicRegistration = {
    id: string;
    player_name: string;
    mode: string;
    timestamp: string;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const key = `public:tournament:${id}:registrations`;
    try {
        const cached = await getCachedData<PublicRegistration[]>(key);
        if (cached) return NextResponse.json({ registrations: cached });

        const registrations = await singleFlight(key, async () => {
            const filled = await getCachedData<PublicRegistration[]>(key);
            if (filled) return filled;
            const { data, error } = await adminDb
                .from('registrations')
                .select('id, player_name, mode, timestamp')
                .eq('tournament_id', id)
                .order('timestamp', { ascending: true });
            if (error) throw error;
            const rows = (data || []) as PublicRegistration[];
            await setCachedData(key, rows, 3);
            return rows;
        });
        return NextResponse.json({ registrations });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
