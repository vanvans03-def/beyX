import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'src/data/cx-attachments.json');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        return NextResponse.json({ success: true, data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'superadmin') {
        return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { key, image_url } = body; // key is 'Heavy' or 'Wheel'
        if (!key || !image_url) {
            return NextResponse.json({ error: 'Key and image URL are required' }, { status: 400 });
        }

        const filePath = path.join(process.cwd(), 'src/data/cx-attachments.json');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        if (data.attachments[key]) {
            data.attachments[key].image = image_url;
        } else {
            return NextResponse.json({ error: 'Invalid attachment key' }, { status: 400 });
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
