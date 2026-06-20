import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';

// Disable SSL check for migration script
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function migrate() {
    const client = new Client({
        connectionString: process.env.POSTGRES_URL_NON_POOLING,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database...');

        // 1. Add music_volume and tts_volume columns if they don't exist
        console.log('Adding music_volume and tts_volume columns...');
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS music_volume DOUBLE PRECISION DEFAULT 0.5,
            ADD COLUMN IF NOT EXISTS tts_volume DOUBLE PRECISION DEFAULT 1.0;
        `);

        console.log('✅ Migration complete: music_volume and tts_volume columns added.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
