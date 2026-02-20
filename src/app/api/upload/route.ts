import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';


export async function POST(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
        return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // We need to parse the body as a stream or buffer. 
    // Request.body is a ReadableStream.
    if (!request.body) {
        return NextResponse.json({ error: 'No file body' }, { status: 400 });
    }

    // Use the token provided by USER in prompt
    const BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_fVvMw9TDy563YstH_T2yOSfDwd4FOzSw5TSXDGCNsiGZwXf";

    try {
        const blob = await put(filename, request.body, {
            access: 'public',
            token: BLOB_READ_WRITE_TOKEN
        });

        return NextResponse.json(blob);
    } catch (e: any) {
        console.error("Blob Upload Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
