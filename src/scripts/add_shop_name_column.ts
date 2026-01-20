
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

        // 1. Add shop_name column if it doesn't exist
        console.log('Adding shop_name column...');
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS shop_name TEXT;
        `);

        // 2. Backfill existing users with their username as shop_name
        console.log('Backfilling existing users...');
        await client.query(`
            UPDATE users 
            SET shop_name = username 
            WHERE shop_name IS NULL;
        `);

        console.log('✅ Migration complete: shop_name column added and backfilled.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
