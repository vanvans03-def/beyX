import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const auth = new JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const doc = new GoogleSpreadsheet(SHEET_ID as string, auth);

export async function getSheet(title: string) {
    if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY || !SHEET_ID) {
        throw new Error('Missing Google Sheets credentials');
    }
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        // Try creating it? Or stick to error. 
        // For 'Tournaments', we can auto-create if missing.
        if (title === 'Tournaments') {
            sheet = await doc.addSheet({ title: 'Tournaments' });
        } else {
            throw new Error(`Sheet '${title}' not found. Please create it.`);
        }
    }

    // Auto-initialize headers
    let headersLoaded = false;
    try {
        await sheet.loadHeaderRow();
        headersLoaded = true;
    } catch (e) {
        // Likely empty sheet, ignoring error to set headers next
        console.log(`[Sheets] Header load failed for ${title} (expected for new sheets).`);
    }

    // Only check headerValues if loaded, otherwise assume need to init
    if (!headersLoaded || sheet.headerValues.length === 0) {
        console.log(`[Sheets] Initializing headers for ${title}...`);
        const headers = title === 'Registrations'
            ? [
                'TournamentID',
                'RoundID',
                'Timestamp',
                'DeviceUUID',
                'PlayerName',
                'Mode',
                'Main_Bey1',
                'Main_Bey2',
                'Main_Bey3',
                'TotalPoints',
                'Reserve_Data'
            ]
            : [ // Tournaments
                'TournamentID',
                'Name',
                'CreatedAt',
                'Status',
                'Config'
            ];
        try {
            await sheet.setHeaderRow(headers);
            // Reload headers to ensure local state is synced
            await sheet.loadHeaderRow();
            console.log(`[Sheets] Headers initialized for ${title}.`);
        } catch (err: any) {
            console.error(`[Sheets] Failed to set headers for ${title}:`, err.message);
            throw new Error(`Failed to initialize sheet ${title}: ${err.message}`);
        }
    } else {
        // Validation: Check if 'TournamentID' is missing in 'Registrations'
        if (title === 'Registrations' && !sheet.headerValues.includes('TournamentID')) {
            console.warn("[Sheets] Schema Mismatch Detected: Missing 'TournamentID'. Initiating Migration...");

            // 1. Fetch all existing data using old headers
            const existingRows = await sheet.getRows();
            const backups = existingRows.map(row => {
                const raw = row.toObject();
                // Assign a default TournamentID to legacy data so it's not lost, 
                // but keep it separate from new valid tournaments.
                return { ...raw, TournamentID: 'LEGACY' };
            });

            // 2. Clear the sheet (wipes headers and data)
            await sheet.clear();

            // 3. Set New Headers
            const newHeaders = [
                'TournamentID',
                'RoundID',
                'Timestamp',
                'DeviceUUID',
                'PlayerName',
                'Mode',
                'Main_Bey1',
                'Main_Bey2',
                'Main_Bey3',
                'TotalPoints',
                'Reserve_Data'
            ];
            await sheet.setHeaderRow(newHeaders);

            // 4. Restore Data
            if (backups.length > 0) {
                console.log(`[Sheets] Migrating ${backups.length} legacy rows...`);
                await sheet.addRows(backups);
            }

            // 5. Reload headers
            await sheet.loadHeaderRow();
            console.log("[Sheets] Migration Complete. Schema matches.");
        }
    }
    return sheet;
}

export type RegistrationRow = {
    TournamentID: string;
    RoundID: string;
    Timestamp: string;
    DeviceUUID: string;
    PlayerName: string;
    Mode: string;
    Main_Bey1: string;
    Main_Bey2: string;
    Main_Bey3: string;
    TotalPoints: string;
    Reserve_Data: string;
};

export type TournamentRow = {
    TournamentID: string;
    Name: string;
    CreatedAt: string;
    Status: string;
    Config: string;
};

// --- Registrations ---

export async function appendRegistration(data: RegistrationRow) {
    const sheet = await getSheet('Registrations');
    await sheet.addRow(data);
}

export async function getRegistrations(tournamentId?: string) {
    const sheet = await getSheet('Registrations');
    const rows = await sheet.getRows();

    console.log(`[Debug] Fetching Registrations. Total Rows: ${rows.length}`);
    console.log(`[Debug] Sheet Headers:`, sheet.headerValues);

    const all = rows.map((row, i) => {
        const tId = row.get('TournamentID');
        if (i < 3) console.log(`[Debug] Row ${i} TournamentID:`, tId, "Raw:", row.toObject());
        return {
            TournamentID: tId,
            RoundID: row.get('RoundID'),
            Timestamp: row.get('Timestamp'),
            DeviceUUID: row.get('DeviceUUID'),
            PlayerName: row.get('PlayerName'),
            Mode: row.get('Mode'),
            Main_Bey1: row.get('Main_Bey1'),
            Main_Bey2: row.get('Main_Bey2'),
            Main_Bey3: row.get('Main_Bey3'),
            TotalPoints: row.get('TotalPoints'),
            Reserve_Data: row.get('Reserve_Data'),
        };
    });

    if (tournamentId) {
        console.log(`[Debug] Filtering for TournamentID: ${tournamentId}`);
        const filtered = all.filter(r => r.TournamentID === tournamentId);
        console.log(`[Debug] Matches found: ${filtered.length}`);
        return filtered;
    }
    return all;
}

export async function deleteRegistration(roundId: string) {
    const sheet = await getSheet('Registrations');
    const rows = await sheet.getRows();
    // RoundID is unique enough
    const row = rows.find(r => r.get('RoundID') === roundId);
    if (row) {
        await row.delete();
    } else {
        throw new Error("Registration not found");
    }
}

// --- Tournaments ---

export async function createTournament(name: string) {
    const sheet = await getSheet('Tournaments');
    const newTournament: TournamentRow = {
        TournamentID: crypto.randomUUID(),
        Name: name,
        CreatedAt: new Date().toISOString(),
        Status: 'OPEN',
        Config: '{}'
    };
    await sheet.addRow(newTournament);
    return newTournament;
}

export async function updateTournamentStatus(tournamentId: string, status: string) {
    const sheet = await getSheet('Tournaments');
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('TournamentID') === tournamentId);
    if (row) {
        row.assign({ Status: status });
        await row.save();
        return row.toObject();
    }
    throw new Error("Tournament not found");
}

export async function getTournaments() {
    const sheet = await getSheet('Tournaments');
    const rows = await sheet.getRows();
    return rows.map(row => ({
        TournamentID: row.get('TournamentID'),
        Name: row.get('Name'),
        CreatedAt: row.get('CreatedAt'),
        Status: row.get('Status'),
        Config: row.get('Config')
    }));
}
