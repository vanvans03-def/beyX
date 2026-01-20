import dotenv from 'dotenv';
import path from 'path';
import { createTournament, createRegistration } from '../lib/repository';
import { v4 as uuidv4 } from 'uuid';
import { Client } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function getAdminUserId() {
    // We need to use pg directly since supabaseAdmin might rely on env vars that are tricky in scripts sometimes, 
    // but actually repository uses supabaseAdmin. 
    // Let's use PG for certainty in this script context or just rely on repository if it works.
    // Actually, repository.ts imports supabaseAdmin which relies on process.env. 
    // Since we loaded dotenv, it should work.
    // But repository doesn't have getUserByName.

    // Let's just use PG client for clarity in script
    const client = new Client({
        connectionString: process.env.POSTGRES_URL_NON_POOLING,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    const res = await client.query("SELECT id FROM users WHERE username = 'admin'");
    await client.end();
    return res.rows[0]?.id;
}

async function main() {
    console.log("Starting load test generation...");

    try {
        const userId = await getAdminUserId();
        if (!userId) throw new Error("Admin user not found in DB");

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const tournamentName = `Load Test 250 - ${timestamp}`;

        console.log(`Creating tournament: ${tournamentName} for user ${userId}`);
        const tournament = await createTournament(tournamentName, userId, 'U10', []);
        console.log(`Tournament created with ID: ${tournament.id}`);

        console.log("Generating 250 registrations...");
        const players = [];
        for (let i = 1; i <= 250; i++) {
            players.push({
                tournament_id: tournament.id,
                player_name: `Player ${i}`,
                device_uuid: uuidv4(),
                mode: 'Under10',
                main_deck: ['DranSword', 'WizardArrow', 'KnightShield'],
                reserve_decks: []
            });
        }

        // Process in batches to avoid overwhelming DB connection if needed
        const batchSize = 50;
        for (let i = 0; i < players.length; i += batchSize) {
            const batch = players.slice(i, i + batchSize);
            console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(players.length / batchSize)}...`);

            await Promise.all(batch.map(p => createRegistration(p)));
        }

        console.log("✅ Successfully created tournament with 250 players.");
        console.log(`Tournament ID: ${tournament.id}`);

    } catch (error) {
        console.error("Error creating load test data:", error);
    }
}

main();
