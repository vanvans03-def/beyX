import { supabaseAdmin } from "@/lib/supabase";
import * as sheets from "@/lib/sheets";
import { v4 as uuidv4 } from 'uuid';

// Types (Mirrors DB Schema)
export type Tournament = {
    id: string;
    name: string;
    status: 'OPEN' | 'CLOSED';
    created_at: Date; // Supabase returns string string, we might need to parse? usually js sdk returns string.
};

export type Registration = {
    id: string;
    tournament_id: string;
    player_name: string;
    device_uuid: string;
    mode: string;
    main_deck: string[];
    reserve_decks: string[][];
    timestamp: Date;
    round_id: string;
};

// --- Tournaments ---

export async function getTournaments(): Promise<Tournament[]> {
    const { data, error } = await supabaseAdmin
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Supabase Error (getTournaments):", error);
        throw new Error(error.message);
    }

    return data.map((r: any) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        created_at: new Date(r.created_at)
    }));
}

export async function createTournament(name: string): Promise<Tournament> {
    const id = uuidv4();
    const status = 'OPEN';
    const created_at = new Date();

    // 1. Supabase
    const { error } = await supabaseAdmin
        .from('tournaments')
        .insert([{ id, name, status, created_at: created_at.toISOString() }]);

    if (error) {
        throw new Error(`Supabase Insert Failed: ${error.message}`);
    }

    // 2. Sheets (Dual Write) - REMOVED per user request
    // try {
    //     await sheets.createTournament(name);
    // } catch (e) {
    //     console.error("Sheets Error (createTournament):", e);
    // }

    return { id, name, status, created_at };
}

export async function updateTournamentStatus(id: string, status: 'OPEN' | 'CLOSED') {
    // 1. Supabase
    const { error } = await supabaseAdmin
        .from('tournaments')
        .update({ status })
        .eq('id', id);

    if (error) {
        throw new Error(error.message);
    }

    // 2. Sheets - REMOVED per user request
    // try {
    //     await sheets.updateTournamentStatus(id, status);
    // } catch (e) {
    //     console.error("Sheets Error (updateTournamentStatus):", e);
    // }
}

// --- Registrations ---

export async function getRegistrations(tournamentId: string): Promise<Registration[]> {
    const { data, error } = await supabaseAdmin
        .from('registrations')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('timestamp', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return data.map((r: any) => ({
        id: r.id,
        tournament_id: r.tournament_id,
        player_name: r.player_name,
        device_uuid: r.device_uuid,
        mode: r.mode,
        main_deck: r.main_deck, // JSONB comes back as object/array automatically
        reserve_decks: r.reserve_decks,
        timestamp: new Date(r.timestamp),
        round_id: r.id
    }));
}

export async function createRegistration(data: Omit<Registration, 'id' | 'timestamp' | 'round_id'>) {
    const id = uuidv4();
    const timestamp = new Date();

    // 1. Supabase
    const { error } = await supabaseAdmin
        .from('registrations')
        .insert([{
            id,
            tournament_id: data.tournament_id,
            player_name: data.player_name,
            device_uuid: data.device_uuid,
            mode: data.mode,
            main_deck: data.main_deck, // Supabase client handles JSON stringifying usually, but depends. JS Object is fine for JSONB col.
            reserve_decks: data.reserve_decks,
            timestamp: timestamp.toISOString()
        }]);

    if (error) {
        throw new Error(`Supabase Registration Failed: ${error.message}`);
    }

    // 2. Sheets - REMOVED per user request
    // try {
    //     const legacyData: sheets.RegistrationRow = {
    //         TournamentID: data.tournament_id,
    //         RoundID: id,
    //         Timestamp: timestamp.toISOString(),
    //         DeviceUUID: data.device_uuid,
    //         PlayerName: data.player_name,
    //         Mode: data.mode,
    //         Main_Bey1: data.main_deck[0] || "",
    //         Main_Bey2: data.main_deck[1] || "",
    //         Main_Bey3: data.main_deck[2] || "",
    //         TotalPoints: "0",
    //         Reserve_Data: JSON.stringify(data.reserve_decks)
    //     };
    //     await sheets.appendRegistration(legacyData);
    // } catch (e) {
    //     console.error("Sheets Error (createRegistration):", e);
    // }
}

export async function deleteRegistration(id: string) {
    // 1. Supabase
    const { error } = await supabaseAdmin
        .from('registrations')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(error.message);
    }

    // 2. Sheets - REMOVED per user request
    // try {
    //     await sheets.deleteRegistration(id);
    // } catch (e) {
    //     console.error("Sheets Error (deleteRegistration):", e);
    // }
}
