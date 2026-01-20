process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { Client } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config({ path: '.env.local' });

// Parse connection string manually to ensure SSL settings work
const connectionString = process.env.POSTGRES_URL_NON_POOLING || '';
const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false,
    },
});

const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASS = 'cyeah';
// Use the API KEY from env as the default for the admin user
const DEFAULT_API_KEY = process.env.CHALLONGE_API_KEY || '';

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to database.');

        // 1. Create Users Table
        console.log('Creating users table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                challonge_api_key TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // 2. Add user_id to tournaments if not exists
        console.log('Adding user_id to tournaments...');
        await client.query(`
            ALTER TABLE tournaments 
            ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
        `);

        // 3. Check if admin user exists, if not create
        console.log('Checking for default admin user...');
        const userRes = await client.query('SELECT id FROM users WHERE username = $1', [DEFAULT_ADMIN_USER]);

        let userId;

        if (userRes.rows.length === 0) {
            console.log('Creating default admin user...');
            const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASS, 10);
            const insertRes = await client.query(`
                INSERT INTO users (username, password_hash, challonge_api_key)
                VALUES ($1, $2, $3)
                RETURNING id;
            `, [DEFAULT_ADMIN_USER, hashedPassword, DEFAULT_API_KEY]);
            userId = insertRes.rows[0].id;
            console.log(`Created user ${DEFAULT_ADMIN_USER} with ID: ${userId}`);
        } else {
            userId = userRes.rows[0].id;
            console.log(`User ${DEFAULT_ADMIN_USER} already exists with ID: ${userId}`);
        }

        // 4. Update existing tournaments to belong to admin (if null)
        console.log('Migrating existing tournaments...');
        const updateRes = await client.query(`
            UPDATE tournaments
            SET user_id = $1
            WHERE user_id IS NULL;
        `, [userId]);

        console.log(`Updated ${updateRes.rowCount} tournaments to be owned by ${DEFAULT_ADMIN_USER}.`);

        console.log('Migration complete successfully.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
