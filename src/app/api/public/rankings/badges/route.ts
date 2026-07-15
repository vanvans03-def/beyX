import { NextResponse } from 'next/server';
import { getRankingBadgesForNames } from '@/lib/ranking-badges';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const names = new URL(request.url).searchParams.getAll('name').map(name => name.trim()).filter(Boolean).slice(0, 256);
        return NextResponse.json({ badges: await getRankingBadgesForNames(names) });
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load ranking badges' }, { status: 500 });
    }
}
