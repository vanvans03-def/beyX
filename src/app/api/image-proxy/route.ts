import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const allowedHost = (hostname: string) =>
    hostname === "fvvmw9tdy563ysth.public.blob.vercel-storage.com" ||
    hostname === "pub-6f0157dfdc22476c9fb6cf71238ed235.r2.dev" ||
    hostname.endsWith(".public.blob.vercel-storage.com") ||
    hostname.endsWith(".r2.dev");

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get("url");

    if (!rawUrl) {
        return NextResponse.json({ error: "Missing image URL" }, { status: 400 });
    }

    let imageUrl: URL;
    try {
        imageUrl = new URL(rawUrl);
    } catch {
        return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }

    if (imageUrl.protocol !== "https:" || !allowedHost(imageUrl.hostname)) {
        return NextResponse.json({ error: "Image host is not allowed" }, { status: 400 });
    }

    const upstream = await fetch(imageUrl, {
        headers: { Accept: "image/*" },
        cache: "force-cache",
    });

    if (!upstream.ok || !upstream.body) {
        return NextResponse.json({ error: "Failed to load image" }, { status: upstream.status || 502 });
    }

    const contentType = upstream.headers.get("content-type") || "image/webp";
    if (!contentType.startsWith("image/")) {
        return NextResponse.json({ error: "URL is not an image" }, { status: 400 });
    }

    return new Response(upstream.body, {
        headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, s-maxage=604800",
        },
    });
}
