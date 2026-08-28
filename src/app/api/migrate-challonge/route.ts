import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json(
        { error: 'Retired endpoint: database schema changes must run through reviewed migration files.' },
        { status: 410 },
    );
}
