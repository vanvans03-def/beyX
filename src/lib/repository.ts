import { supabaseAdmin } from "@/lib/supabase";
import * as sheets from "@/lib/sheets";
import { v4 as uuidv4 } from 'uuid';

// Types (Mirrors DB Schema)
export type Tournament = {
    id: string;
    name: string;
    status: 'OPEN' | 'CLOSED';
    created_at: Date;
    type: 'U10' | 'NoMoreMeta' | 'Open';
    ban_list: string[];
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

// --- Settings ---

export async function getSystemSetting<T>(key: string, defaultValue: T): Promise<T> {
    const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', key)
        .single();

    if (error || !data) return defaultValue;
    return data.value as T;
}

export async function setSystemSetting<T>(key: string, value: T) {
    const { error } = await supabaseAdmin
        .from('system_settings')
        .upsert({ key, value: value as any });

    if (error) throw new Error(error.message);
}

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
        created_at: new Date(r.created_at),
        type: r.type || 'U10', // Default for legacy data
        ban_list: r.ban_list || []
    }));
}

export async function getTournament(id: string): Promise<Tournament | null> {
    const { data, error } = await supabaseAdmin
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(error.message);
    }

    return {
        id: data.id,
        name: data.name,
        status: data.status,
        created_at: new Date(data.created_at),
        type: data.type || 'U10',
        ban_list: data.ban_list || []
    };
}

export async function createTournament(name: string, type: 'U10' | 'NoMoreMeta' | 'Open' = 'U10', ban_list: string[] = []): Promise<Tournament> {
    const id = uuidv4();
    const status = 'OPEN';
    const created_at = new Date();

    // 1. Supabase
    const { error } = await supabaseAdmin
        .from('tournaments')
        .insert([{
            id,
            name,
            status,
            created_at: created_at.toISOString(),
            type,
            ban_list
        }]);

    if (error) {
        throw new Error(`Supabase Insert Failed: ${error.message}`);
    }

    // 2. Sheets (Dual Write) - REMOVED per user request
    // try {
    //     await sheets.createTournament(name);
    // } catch (e) {
    //     console.error("Sheets Error (createTournament):", e);
    // }

    return { id, name, status, created_at, type, ban_list };
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

// --- Events ---

export type Event = {
    id: string;
    title: string;
    description: string;
    event_date: Date;
    location: string;
    map_link: string;
    facebook_link: string;
    image_url: string;
    created_at: Date;
};

export async function getEvents(): Promise<Event[]> {
    const { data, error } = await supabaseAdmin
        .from('events')
        .select('*')
        .order('event_date', { ascending: true }); // Soonest first for upcoming check

    if (error) {
        // If table doesn't exist yet, return empty to prevent crash
        if (error.code === '42P01') return [];
        throw new Error(error.message);
    }

    return data.map((e: any) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        event_date: new Date(e.event_date),
        location: e.location,
        map_link: e.map_link,
        facebook_link: e.facebook_link,
        image_url: e.image_url,
        created_at: new Date(e.created_at)
    }));
}

export async function createEvent(data: Omit<Event, 'id' | 'created_at'>): Promise<Event> {
    const id = uuidv4();
    const created_at = new Date();

    const { error } = await supabaseAdmin
        .from('events')
        .insert([{
            id,
            title: data.title,
            description: data.description,
            event_date: data.event_date.toISOString(),
            location: data.location,
            map_link: data.map_link,
            facebook_link: data.facebook_link,
            image_url: data.image_url,
            created_at: created_at.toISOString()
        }]);

    if (error) throw new Error(error.message);

    return { id, created_at, ...data };
}

export async function updateEvent(id: string, data: Partial<Omit<Event, 'id' | 'created_at'>>): Promise<Event | null> {
    const { data: updated, error } = await supabaseAdmin
        .from('events')
        .update({
            title: data.title,
            description: data.description,
            event_date: data.event_date ? data.event_date.toISOString() : undefined,
            location: data.location,
            map_link: data.map_link,
            facebook_link: data.facebook_link,
            image_url: data.image_url
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);

    if (!updated) return null;

    return {
        ...updated,
        event_date: new Date(updated.event_date),
        created_at: new Date(updated.created_at)
    };
}

export async function deleteEvent(id: string) {
    const { error } = await supabaseAdmin
        .from('events')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
}
