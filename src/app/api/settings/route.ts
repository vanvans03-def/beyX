import { NextResponse } from "next/server";
import { getSystemSetting, setSystemSetting } from "@/lib/repository";


export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });

    try {
        // Default 'true' for event_system_active if not found
        const value = await getSystemSetting(key, true);
        return NextResponse.json({ success: true, value });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { key, value } = body;
        if (!key) return NextResponse.json({ error: "Key and Value required" }, { status: 400 });

        await setSystemSetting(key, value);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
