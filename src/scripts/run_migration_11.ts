import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Client } from 'pg';

// Disable SSL verification for scripts running locally/CI
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runMigration() {
    const connectionString = process.env.POSTGRES_URL_NON_POOLING;
    if (!connectionString) {
        console.error('Error: POSTGRES_URL_NON_POOLING environment variable is not defined.');
        process.exit(1);
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to PostgreSQL database.');

        const sqlPath = path.resolve(process.cwd(), 'migrations', '11_system_upgrade.sql');
        console.log(`Reading migration query from: ${sqlPath}`);
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing migration script...');
        await client.query(sqlContent);
        console.log('✅ Migration 11_system_upgrade.sql completed successfully.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
