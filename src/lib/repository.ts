import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuidv4 } from 'uuid';

// Types (Mirrors DB Schema)
export type Tournament = {
    id: string;
    name: string;
    status: 'OPEN' | 'CLOSED' | 'STARTED' | 'COMPLETED';
    created_at: Date;
    type: 'U10' | 'U10South' | 'NoMoreMeta' | 'Open';
    ban_list: string[];
    challonge_url?: string;
    user_id?: string; // Added for ownership check
    organizer_name?: string;
    arena_count?: number;
    provider?: 'CHALLONGE' | 'INTERNAL';
    bracket_type?: 'SINGLE' | 'DOUBLE';
    settings?: any;
};

export type Registration = {
    id: string;
    tournament_id: string;
    player_name: string;
    device_uuid: string;
    mode: string;
    main_deck: string[];
    timestamp: Date;
    round_id: string;
    total_points?: number;
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

// [SECURE] Must provide userId to list own tournaments
export async function getTournaments(userId: string): Promise<Tournament[]> {
    if (!userId) throw new Error("Unauthorized: userId required");

    const { data, error } = await supabaseAdmin
        .from('tournaments')
        .select('*')
        .eq('user_id', userId)
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
        type: r.type || 'U10',
        ban_list: r.ban_list || [],
        challonge_url: r.challonge_url,
        arena_count: r.arena_count,
        user_id: r.user_id,
        provider: r.provider || 'CHALLONGE',
        bracket_type: r.bracket_type || 'SINGLE',
        settings: r.settings || {}
    }));
}

export async function getTournament(id: string): Promise<Tournament | null> {
    // Try UUID first
    let query = supabaseAdmin.from('tournaments').select('*');
    
    // Simple check if it's a UUID
    const looksLikeUUID = id.includes('-') || (id.length === 36 || id.length === 32);
    
    if (looksLikeUUID) {
        query = query.eq('id', id);
    } else {
        query = query.ilike('name', id);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
        if (error) console.error("getTournament Error:", error);
        if (looksLikeUUID) {
            const { data: nameData } = await supabaseAdmin.from('tournaments').select('*').ilike('name', id).maybeSingle();
            if (nameData) return await enrichTournament(nameData);
        }
        return null;
    }

    return await enrichTournament(data);
}

// Helper for enrichment
async function enrichTournament(data: any): Promise<Tournament | null> {
    // Fetch user separately for reliability (avoid join issues)
    let organizerName = "Unknown Organizer";
    if (data.user_id) {
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('shop_name, username')
            .eq('id', data.user_id)
            .maybeSingle();
        if (user) {
            organizerName = user.shop_name || user.username || organizerName;
        }
    }

    return {
        id: data.id,
        name: data.name,
        status: data.status,
        created_at: new Date(data.created_at),
        type: data.type || 'U10',
        ban_list: data.ban_list || [],
        challonge_url: data.challonge_url,
        arena_count: data.arena_count,
        user_id: data.user_id,
        organizer_name: organizerName,
        provider: data.provider || 'CHALLONGE',
        bracket_type: data.bracket_type || 'SINGLE',
        settings: data.settings || {}
    };
}

export async function getTournamentByShortId(shopName: string, shortId: string): Promise<Tournament | null> {
    const cleanShopName = decodeURIComponent(shopName).trim();

    // 1. Find user by shop name OR username (Case-Insensitive)
    const { data: users, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, shop_name, username')
        .or(`shop_name.ilike."${cleanShopName}",username.ilike."${cleanShopName}"`);

    if (userError || !users || users.length === 0) {
        return null;
    }

    const user = users[0];

    // 2. Fetch all tournaments for this user to match short ID
    const { data: tournaments, error: tourError } = await supabaseAdmin
        .from('tournaments')
        .select('*')
        .eq('user_id', user.id);

    if (tourError || !tournaments) {
        console.log(`[Repo] Tournaments error:`, tourError);
        return null;
    }

    console.log(`[Repo] Found ${tournaments.length} tournaments for user`);

    // 3. Find match (Full UUID or End of UUID)
    // Supports 8-character short ID or full UUID
    const cleanShortId = shortId.trim().toLowerCase();
    const match = tournaments.find(t => {
        const fullId = t.id.toLowerCase();
        const strippedId = fullId.replace(/-/g, '');
        return fullId === cleanShortId || 
               fullId.endsWith(cleanShortId) || 
               strippedId.endsWith(cleanShortId);
    });

    if (!match) {
        return null;
    }

    const organizerName = user.shop_name || user.username || "Unknown Organizer";

    return {
        id: match.id,
        name: match.name,
        status: match.status,
        created_at: new Date(match.created_at),
        type: match.type || 'U10',
        ban_list: match.ban_list || [],
        challonge_url: match.challonge_url,
        arena_count: match.arena_count,
        user_id: match.user_id,
        organizer_name: organizerName,
        provider: match.provider || 'CHALLONGE',
        bracket_type: match.bracket_type || 'SINGLE',
        settings: match.settings || {}
    };
}

export async function createTournament(
    name: string, 
    userId: string, 
    type: 'U10' | 'U10South' | 'NoMoreMeta' | 'Open' = 'U10', 
    ban_list: string[] = [],
    provider: 'CHALLONGE' | 'INTERNAL' = 'CHALLONGE',
    bracket_type: 'SINGLE' | 'DOUBLE' = 'SINGLE'
): Promise<Tournament> {
    if (!userId) throw new Error("Unauthorized: Cannot create tournament without userId");

    const id = uuidv4();
    const status = 'OPEN';
    const created_at = new Date();

    // 1. Supabase
    const { error } = await supabaseAdmin
        .from('tournaments')
        .insert({
            id,
            name,
            status,
            created_at,
            type,
            ban_list,
            user_id: userId,
            provider,
            bracket_type
        });


    if (error) {
        throw new Error(`Supabase Insert Failed: ${error.message}`);
    }

    // 2. Sheets (Dual Write) - REMOVED per user request
    // try {
    //     await sheets.createTournament(name);
    // } catch (e) {
    //     console.error("Sheets Error (createTournament):", e);
    // }

    return { id, name, status, created_at, type, ban_list, provider, bracket_type };
}

export async function updateTournamentStatus(id: string, status: 'OPEN' | 'CLOSED') {
    // Resolve name to ID if needed
    const tour = await getTournament(id);
    const actualId = tour?.id || id;

    const { error } = await supabaseAdmin
        .from('tournaments')
        .update({ status })
        .eq('id', actualId);

    if (error) {
        throw new Error(error.message);
    }
}

export async function resetTournamentBracket(id: string) {
    // Resolve name to ID if needed
    const tour = await getTournament(id);
    const actualId = tour?.id || id;

    const { error: tError } = await supabaseAdmin
        .from('tournaments')
        .update({ status: 'OPEN', challonge_url: null })
        .eq('id', actualId);

    if (tError) throw new Error(tError.message);

    // Delete internal matches to allow restart
    const { error: mError } = await supabaseAdmin
        .from('internal_matches')
        .delete()
        .eq('tournament_id', actualId);

    if (mError) {
        console.warn("Could not delete internal matches during reset:", mError);
    }
}

export async function getMatchesFromDB(tournamentIdentifier: string) {
    // 1. Try to find the tournament UUID from the identifier (url slug)
    const { data: tour } = await supabaseAdmin
        .from('tournaments')
        .select('id')
        .ilike('challonge_url', `%${tournamentIdentifier}`)
        .limit(1)
        .maybeSingle();

    if (!tour) {
        console.warn(`Fallback: No tournament found for identifier ${tournamentIdentifier}`);
        return [];
    }

    // 2. Try to find a link via match_locks (Bridge: UUID -> MatchID -> IntID)
    const { data: locks } = await supabaseAdmin
        .from('match_locks')
        .select('match_id')
        .eq('tournament_id', tour.id)
        .limit(1);

    let challongeTournamentId: number | null = null;

    if (locks && locks.length > 0) {
        // We have a lock, use it to find the Challonge Tournament ID from the matches table
        const { data: linkedMatch } = await supabaseAdmin
            .from('matches')
            .select('tournament_id')
            .eq('id', locks[0].match_id)
            .single();

        if (linkedMatch) {
            challongeTournamentId = linkedMatch.tournament_id;
        }
    }

    // 3. Query matches
    let query = supabaseAdmin
        .from('matches')
        .select('*')
        .order('suggested_play_order', { ascending: true });

    if (challongeTournamentId) {
        // Precise search
        query = query.eq('tournament_id', challongeTournamentId);
    } else {
        // Fallback to fuzzy search if we couldn't bridge (unlikely to work if matches table doesn't have identifier slug correctly)
        // But maybe some rows do? Or if we add it in future.
        // For now, if we fail to link, checking 'identifier' is better than nothing, though likely empty.
        query = query.eq('identifier', tournamentIdentifier);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Fallback Query Error:", error.message);
        return [];
    }

    return data.map((m: any) => ({
        id: m.id,
        tournament_id: m.tournament_id,
        state: m.state,
        player1_id: m.player1_id,
        player2_id: m.player2_id,
        scores_csv: m.score_csv, // Map back
        winner_id: m.winner_id,
        round: m.round,
        identifier: m.identifier,
        suggested_play_order: m.suggested_play_order,
        underway_at: m.underway_at,
        completed_at: m.completed_at,
        updated_at: m.updated_at,
        // Use cached names from DB — populated during Challonge sync
        player1: { id: m.player1_id, name: m.player1_name || "???", misc: "" },
        player2: { id: m.player2_id, name: m.player2_name || "???", misc: "" }
    }));
}

// Helper to get User's API Key
export async function getUserApiKey(userId: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('challonge_api_key')
        .eq('id', userId)
        .single();

    if (error || !data) return null;
    return data.challonge_api_key;
}


// --- Registrations ---

export async function getRegistrations(tournamentId: string): Promise<Registration[]> {
    const { data, error } = await supabaseAdmin
        .from('registrations')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('timestamp', { ascending: false });

    if (error) {
        console.error(`[Repo] getRegistrations error for ${tournamentId}:`, error);
        throw new Error(error.message);
    }

    return data.map((r: any) => ({
        id: r.id,
        tournament_id: r.tournament_id,
        player_name: r.player_name,
        device_uuid: r.device_uuid,
        mode: r.mode,
        main_deck: r.main_deck || [],
        timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
        round_id: r.round_id || r.id,
        total_points: r.total_points || 0
    }));
}

export async function upsertRegistration(data: Omit<Registration, 'id' | 'timestamp' | 'round_id'>) {
    const timestamp = new Date();

    // 1. Check for existing registration (same tournament + same name + same device)
    // This allows updates to own registrations even if started
    const { data: existing } = await supabaseAdmin
        .from('registrations')
        .select('id, device_uuid')
        .eq('tournament_id', data.tournament_id)
        .ilike('player_name', data.player_name.trim())
        .maybeSingle();

    if (existing) {
        // UPDATE case
        // Verify device matches to prevent hijacking
        if (existing.device_uuid !== data.device_uuid) {
            throw new Error(`Player "${data.player_name}" is already registered by another device.`);
        }

        const { error } = await supabaseAdmin
            .from('registrations')
            .update({
                mode: data.mode,
                main_deck: data.main_deck,
                // We keep the original timestamp or update it? User said "update combo only"
                // Usually good to keep original timestamp for seed/order.
            })
            .eq('id', existing.id);

        if (error) throw new Error(`Update Failed: ${error.message}`);
        return { id: existing.id, status: 'updated' };
    }

    // 2. INSERT Case
    const id = uuidv4();
    const { error } = await supabaseAdmin
        .from('registrations')
        .insert([{
            id,
            tournament_id: data.tournament_id,
            player_name: data.player_name.trim(),
            device_uuid: data.device_uuid,
            mode: data.mode,
            main_deck: data.main_deck,
            timestamp: timestamp.toISOString()
        }]);

    if (error) throw new Error(`Insert Failed: ${error.message}`);
    return { id, status: 'created' };
}

export async function createRegistration(data: Omit<Registration, 'id' | 'timestamp' | 'round_id'>) {
    const id = uuidv4();
    const timestamp = new Date();

    // Check for duplicate name (Case Insensitive)
    // Use select instead of maybeSingle to safely handle if multiple duplicates already exist (legacy data)
    const { data: existing } = await supabaseAdmin
        .from('registrations')
        .select('id')
        .eq('tournament_id', data.tournament_id)
        .ilike('player_name', data.player_name.trim()) // Ensure we match against trimmed input
        .limit(1);

    if (existing && existing.length > 0) {
        throw new Error(`Player "${data.player_name}" is already registered (ชื่อซ้ำ).`);
    }

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
