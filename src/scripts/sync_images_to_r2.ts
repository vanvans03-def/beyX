import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Client } from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Disable SSL verification for scripts running locally
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Load environment variables from .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const r2AccountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
const r2AccessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
const r2SecretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
const r2BucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();
const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim() || '';
const connectionString = process.env.POSTGRES_URL_NON_POOLING;

async function sync() {
    // 1. Validate Configurations
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName || !r2PublicUrl) {
        console.error('❌ Error: Cloudflare R2 settings are not completely configured in environment variables.');
        process.exit(1);
    }

    if (!connectionString) {
        console.error('❌ Error: POSTGRES_URL_NON_POOLING is not defined in environment variables.');
        process.exit(1);
    }

    console.log('--- Cloudflare R2 Config ---');
    console.log('Account ID:', r2AccountId);
    console.log('Bucket Name:', r2BucketName);
    console.log('Public URL:', r2PublicUrl);
    console.log('----------------------------');

    // 2. Initialize S3 Client & DB Client
    const r2 = new S3Client({
        region: 'auto',
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: r2AccessKeyId,
            secretAccessKey: r2SecretAccessKey,
        },
        forcePathStyle: true,
    });

    const dbClient = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await dbClient.connect();
        console.log('Connected to PostgreSQL database.');

        // Load current image-map.json
        const imageMapPath = path.resolve(process.cwd(), 'src', 'data', 'image-map.json');
        let imageMap: Record<string, string> = {};
        if (fs.existsSync(imageMapPath)) {
            imageMap = JSON.parse(fs.readFileSync(imageMapPath, 'utf8'));
            console.log(`Loaded ${Object.keys(imageMap).length} entries from image-map.json`);
        }

        // 3. Retrieve all beyblades from database
        const res = await dbClient.query('SELECT id, name, image_url FROM beyblades');
        const dbBeyblades = res.rows;
        console.log(`Retrieved ${dbBeyblades.length} Beyblade records from database.`);

        const cleanBaseUrl = r2PublicUrl.endsWith('/') ? r2PublicUrl.slice(0, -1) : r2PublicUrl;
        const localImagesDir = path.resolve(process.cwd(), 'public', 'images', 'Blade');

        // Track stats
        let uploadedCount = 0;
        let dbUpdatedCount = 0;
        let jsonUpdatedCount = 0;

        // Keep track of uploaded R2 keys to avoid redundant uploads in the same run
        const uploadedKeys = new Set<string>();

        // Helper function to upload file to R2
        async function uploadFileToR2(filename: string): Promise<string> {
            const localFilePath = path.join(localImagesDir, filename);
            if (!fs.existsSync(localFilePath)) {
                throw new Error(`File not found on disk: ${localFilePath}`);
            }

            const r2Key = `Blade/${filename}`;
            const r2Url = `${cleanBaseUrl}/Blade/${encodeURIComponent(filename)}`;

            if (uploadedKeys.has(r2Key)) {
                return r2Url;
            }

            const fileBuffer = fs.readFileSync(localFilePath);
            console.log(`Uploading local file: ${filename} to key: ${r2Key}...`);
            
            await r2.send(new PutObjectCommand({
                Bucket: r2BucketName,
                Key: r2Key,
                Body: fileBuffer,
                ContentType: 'image/webp',
            }));

            uploadedKeys.add(r2Key);
            uploadedCount++;
            return r2Url;
        }

        // Process items
        for (const bey of dbBeyblades) {
            const { id, name, image_url: currentUrl } = bey;

            let targetFilename = '';

            // Check if current URL is a local path
            if (currentUrl.startsWith('/images/Blade/') || currentUrl.startsWith('images/Blade/')) {
                targetFilename = path.basename(currentUrl);
            } else if (!currentUrl.startsWith('http') && currentUrl.endsWith('.webp')) {
                // If it's a relative path of some kind
                targetFilename = path.basename(currentUrl);
            }

            if (targetFilename) {
                try {
                    const r2Url = await uploadFileToR2(targetFilename);

                    // Update Database
                    await dbClient.query('UPDATE beyblades SET image_url = $1 WHERE id = $2', [r2Url, id]);
                    dbUpdatedCount++;

                    // Update Image Map JSON memory
                    imageMap[name] = r2Url;
                    jsonUpdatedCount++;

                    console.log(`✅ Synced: ${name} -> ${r2Url}`);
                } catch (err: any) {
                    console.error(`❌ Failed to sync file for ${name} (${targetFilename}):`, err.message);
                }
            } else {
                console.log(`ℹ️ Skipped DB row ${name} (already has public image URL or non-local: ${currentUrl})`);
                // Even if skipped, let's check if we should map its current URL (e.g. Vercel Blob or R2) to image-map.json
                if (currentUrl.startsWith('http')) {
                    if (imageMap[name] !== currentUrl) {
                        imageMap[name] = currentUrl;
                        jsonUpdatedCount++;
                    }
                }
            }
        }

        // 4. Also scan image-map.json for any keys that were not in database but still have local paths
        for (const [name, url] of Object.entries(imageMap)) {
            if (url.startsWith('/images/Blade/') || url.startsWith('images/Blade/')) {
                const targetFilename = path.basename(url);
                try {
                    const r2Url = await uploadFileToR2(targetFilename);
                    imageMap[name] = r2Url;
                    jsonUpdatedCount++;
                    console.log(`✅ Synced from static map: ${name} -> ${r2Url}`);
                } catch (err: any) {
                    console.error(`❌ Failed to sync static map entry for ${name} (${targetFilename}):`, err.message);
                }
            }
        }

        // 5. Write updated image-map.json back to disk
        fs.writeFileSync(imageMapPath, JSON.stringify(imageMap, null, 4), 'utf8');
        console.log('✅ Updated src/data/image-map.json with new R2 URLs.');

        console.log('\n--- Sync Statistics ---');
        console.log('Total Local Files Uploaded to R2:', uploadedCount);
        console.log('Database Rows Updated:', dbUpdatedCount);
        console.log('Image Map JSON Entries Updated/Added:', jsonUpdatedCount);
        console.log('------------------------');

    } catch (err) {
        console.error('❌ Sync script failed:', err);
    } finally {
        await dbClient.end();
    }
}

sync();
