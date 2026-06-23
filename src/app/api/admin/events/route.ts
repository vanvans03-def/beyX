import { NextResponse } from "next/server";
import { getEvents, createEvent, deleteEvent, updateEvent } from "@/lib/repository";
import { supabaseAdmin } from "@/lib/supabase";

async function checkEventMode(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return { allowed: false, status: 401, error: "Unauthorized" };

    const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('event_mode_enabled, role')
        .eq('id', userId)
        .single();

    if (error || !user) {
        return { allowed: false, status: 500, error: error?.message || "User not found" };
    }

    if (user.role !== 'superadmin' && user.event_mode_enabled === false) {
        return { allowed: false, status: 403, error: "ฟังก์ชันจัดการอีเว้นท์ถูกปิดใช้งานโดย Super Admin" };
    }

    return { allowed: true, userId };
}

export async function GET() {
    try {
        const events = await getEvents();
        // Return structured data
        const mapped = events.map(e => ({
            id: e.id,
            title: e.title,
            date: e.event_date.toISOString(),
            location: e.location,
            image: e.image_url,
            map: e.map_link,
            fb: e.facebook_link
        }));
        return NextResponse.json({ success: true, data: mapped });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const check = await checkEventMode(req);
        if (!check.allowed) return NextResponse.json({ success: false, error: check.error }, { status: check.status });

        const body = await req.json();
        // Validation handled in frontend mostly, but basic checks:
        if (!body.title || !body.date) throw new Error("Title and Date required");

        const newEvent = await createEvent({
            title: body.title,
            description: body.description || "",
            event_date: new Date(body.date),
            location: body.location || "",
            map_link: body.map_link || "",
            facebook_link: body.facebook_link || "",
            image_url: body.image_url || ""
        });

        return NextResponse.json({ success: true, data: newEvent });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const check = await checkEventMode(req);
        if (!check.allowed) return NextResponse.json({ success: false, error: check.error }, { status: check.status });

        const body = await req.json();
        const { id, ...data } = body;

        if (!id) return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });

        const updated = await updateEvent(id, {
            ...data,
            event_date: data.date ? new Date(data.date) : undefined
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const check = await checkEventMode(req);
        if (!check.allowed) return NextResponse.json({ success: false, error: check.error }, { status: check.status });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) throw new Error("ID required");

        await deleteEvent(id);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
