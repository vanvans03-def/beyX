import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const originalFilename = searchParams.get('filename') || 'image.png';

    if (!request.body) {
        return NextResponse.json({ error: 'No file body' }, { status: 400 });
    }

    try {
        // 1. อ่านไฟล์จาก Request Stream แปลงเป็น Buffer มาตรฐาน
        const arrayBuffer = await request.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. บีบอัดรูปภาพด้วย Sharp เป็นฟอร์แมต WebP พร้อมแก้ปัญหา SharedArrayBuffer
        let webpBuffer: Buffer;
        try {
            const sharpResult = await sharp(buffer)
                .webp({ quality: 80 })
                .toBuffer();

            // ทำ Deep Copy เพื่อบังคับให้เป็น Standard Buffer ป้องกัน AWS SDK แครช
            webpBuffer = Buffer.alloc(sharpResult.length);
            sharpResult.copy(webpBuffer);
        } catch (err: any) {
            console.error("Sharp compression failed, falling back to original upload buffer:", err);

            // ทำ Deep Copy สำหรับตัว Fallback เช่นกัน
            webpBuffer = Buffer.alloc(buffer.length);
            buffer.copy(webpBuffer);
        }

        // 3. ตั้งชื่อไฟล์ใหม่โดยใส่ Timestamp และบังคับนามสกุลเป็น .webp
        const baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const newFilename = `${baseName}_${timestamp}.webp`;

        // 4. ดึงค่าคอนฟิกสำหรับ Cloudflare R2 จาก Environment Variables
        const r2AccountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
        const r2AccessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
        const r2SecretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
        const r2BucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();
        const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim() || '';

        // ตรวจสอบความถูกต้องของคีย์ R2
        const r2Configured = r2AccountId && r2AccountId !== 'your_account_id' &&
            r2AccessKeyId && r2AccessKeyId !== 'your_access_key_id' &&
            r2SecretAccessKey && r2SecretAccessKey !== 'your_secret_access_key' &&
            r2BucketName && r2BucketName !== 'your_bucket_name';

        // 5. หากไม่ได้ตั้งค่า R2 หรือคีย์ไม่ครบ ให้โยนไปเซฟที่ Vercel Blob แทน (Fallback)
        if (!r2Configured) {
            console.warn("Cloudflare R2 is not configured, falling back to Vercel Blob.");
            const { put } = await import('@vercel/blob');
            const blob = await put(newFilename, webpBuffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN
            });
            return NextResponse.json(blob);
        }

        // 6. เริ่มกระบวนการเชื่อมต่อและอัปโหลดขึ้น Cloudflare R2
        try {
            const r2 = new S3Client({
                region: 'auto',
                endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
                credentials: {
                    accessKeyId: r2AccessKeyId!,
                    secretAccessKey: r2SecretAccessKey!,
                },
                forcePathStyle: true,
            });

            await r2.send(new PutObjectCommand({
                Bucket: r2BucketName!,
                Key: newFilename,
                Body: webpBuffer,
                ContentType: 'image/webp',
            }));

            // 7. จัดการฟอร์แมต Public URL และส่งข้อมูลกลับไปที่หน้าบ้าน
            const cleanBaseUrl = r2PublicUrl.endsWith('/') ? r2PublicUrl.slice(0, -1) : r2PublicUrl;
            const publicUrl = `${cleanBaseUrl}/${newFilename}`;

            return NextResponse.json({
                url: publicUrl,
                pathname: newFilename,
                contentType: 'image/webp',
            });
        } catch (r2Error: any) {
            console.error("Cloudflare R2 upload failed, trying fallback to Vercel Blob:", r2Error);
            console.error("R2 Config details at failure:", {
                accountId: r2AccountId,
                bucketName: r2BucketName,
                publicUrl: r2PublicUrl,
                hasAccessKeyId: !!r2AccessKeyId,
                hasSecretAccessKey: !!r2SecretAccessKey,
                errorName: r2Error.name,
                errorMessage: r2Error.message,
                errorStack: r2Error.stack
            });

            // 7. Fallback to Vercel Blob
            const { put } = await import('@vercel/blob');
            const blob = await put(newFilename, webpBuffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN
            });
            return NextResponse.json(blob);
        }
    } catch (e: any) {
        console.error("Image Upload Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}