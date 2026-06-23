import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Client } from 'pg';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function seed() {
    const connectionString = process.env.POSTGRES_URL_NON_POOLING;
    if (!connectionString) {
        console.error('Error: POSTGRES_URL_NON_POOLING not defined.');
        process.exit(1);
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        // Load JSON data
        const standardPath = path.resolve(process.cwd(), 'src', 'data', 'game-data-standard.json');
        const southPath = path.resolve(process.cwd(), 'src', 'data', 'game-data-south.json');
        const imageMapPath = path.resolve(process.cwd(), 'src', 'data', 'image-map.json');

        const standardData = JSON.parse(fs.readFileSync(standardPath, 'utf8'));
        const southData = JSON.parse(fs.readFileSync(southPath, 'utf8'));
        const imageMap = JSON.parse(fs.readFileSync(imageMapPath, 'utf8'));

        // Collect all unique beyblade names
        const allNames = new Set<string>();

        // From image map
        Object.keys(imageMap).forEach(k => allNames.add(k));

        // From standard points
        Object.values(standardData.points).forEach((names: any) => {
            names.forEach((name: string) => allNames.add(name));
        });

        // From south points
        Object.values(southData.points).forEach((names: any) => {
            names.forEach((name: string) => allNames.add(name));
        });

        // From ban lists
        if (standardData.banList) standardData.banList.forEach((name: string) => allNames.add(name));
        if (southData.banList) southData.banList.forEach((name: string) => allNames.add(name));

        console.log(`Found ${allNames.size} unique Beyblades in static JSON files.`);

        // Clear existing beyblades to start clean if needed, or upsert. Let's do upsert on name.
        let insertedCount = 0;
        for (const name of allNames) {
            // Determine default points standard
            let pointsStandard = 0;
            for (const [ptStr, list] of Object.entries(standardData.points)) {
                if ((list as string[]).includes(name)) {
                    pointsStandard = parseInt(ptStr);
                    break;
                }
            }

            // Determine default points south
            let pointsSouth = 0;
            for (const [ptStr, list] of Object.entries(southData.points)) {
                if ((list as string[]).includes(name)) {
                    pointsSouth = parseInt(ptStr);
                    break;
                }
            }

            // Determine image URL
            const imageUrl = imageMap[name] || `/images/Blade/${name}.webp`;

            // Determine ban status (banned if in standard banList or south banList)
            const isBanned = (standardData.banList && standardData.banList.includes(name)) ||
                             (southData.banList && southData.banList.includes(name));

            // Upsert query
            await client.query(`
                INSERT INTO beyblades (name, image_url, points_standard, points_south, is_banned)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (name) DO UPDATE 
                SET image_url = EXCLUDED.image_url,
                    points_standard = EXCLUDED.points_standard,
                    points_south = EXCLUDED.points_south,
                    is_banned = EXCLUDED.is_banned;
            `, [name, imageUrl, pointsStandard, pointsSouth, isBanned]);

            insertedCount++;
        }

        console.log(`✅ Database seeding completed: ${insertedCount} Beyblades inserted/updated.`);

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await client.end();
    }
}

seed();
