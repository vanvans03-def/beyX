import { NextResponse } from "next/server";
import { createRegistration, upsertRegistration } from "@/lib/repository";
import gameData from "@/data/game-data.json";
import gameDataStandard from "@/data/game-data-standard.json";
import gameDataSouth from "@/data/game-data-south.json";
import { supabaseAdmin } from "@/lib/supabase";
import beySeries from "@/data/bey-series.json";

export const dynamic = 'force-dynamic';

// Database-driven Validation Logic
function validatePayloadDb(body: any, resolvedBeys: any[], resolvedBans: string[], cxEnabled: boolean = true) {
    const { playerName, mode, mainBeys } = body;
    if (!playerName || !mode || !Array.isArray(mainBeys) || mainBeys.length !== 3) {
        return { valid: false, message: "Invalid payload structure" };
    }

    // Parse names (strip custom suffixes)
    const cleanBeys = mainBeys.map((name: string) => name ? name.split('|')[0] : '');

    // Check uniqueness of attachments across the entire deck
    const usedAttachments: string[] = [];
    for (let idx = 0; idx < mainBeys.length; idx++) {
        const combo = mainBeys[idx];
        if (!combo) continue;
        const parts = combo.split('|');
        const beyName = parts[0];
        
        const isCX = beyName && (resolvedBeys.find(b => b.name === beyName)?.type === 'CX' || beySeries.series.CX.includes(beyName));

        if (parts.length >= 4) {
            // New format: Blade|LockChip|AssistBlade|Rachet|Bit
            const lc = parts[1];
            const ab = parts[2];
            const rc = parts[3];
            const bt = parts[4];

            if (lc && isCX) usedAttachments.push(lc);
            if (ab && isCX) usedAttachments.push(ab);
            if (rc) usedAttachments.push(rc);
            if (bt) usedAttachments.push(bt);
        } else {
            // Legacy format: Blade|SpecialCX|Normal
            const spec = parts[1];
            const norm = parts[2];

            if (spec && isCX) usedAttachments.push(spec);
            if (norm) usedAttachments.push(norm);
        }
    }

    const duplicates = usedAttachments.filter((item, index) => usedAttachments.indexOf(item) !== index);
    if (duplicates.length > 0) {
        return { valid: false, message: `Duplicate attachment found in deck: ${duplicates[0]}` };
    }

    // Check Bans for Beyblade and Attachments
    if (mode === "NoMoreMeta") {
        for (let idx = 0; idx < mainBeys.length; idx++) {
            const combo = mainBeys[idx];
            if (!combo) continue;
            const parts = combo.split('|');
            const beyName = parts[0];

            // 1. Check Beyblade Ban
            if (resolvedBans.includes(beyName)) {
                return { valid: false, message: `Contains Banned Beyblade: ${beyName}` };
            }

            // 2. Check Attachments Ban
            if (parts.length >= 4) {
                const lc = parts[1];
                const ab = parts[2];
                const rc = parts[3];
                const bt = parts[4];

                if (lc) {
                    const lcObj = resolvedBeys.find(b => b.name === lc && b.type === 'LOCK_CHIP');
                    if (lcObj?.is_banned) return { valid: false, message: `Contains Banned Lock Chip: ${lc}` };
                }
                if (ab) {
                    const abObj = resolvedBeys.find(b => b.name === ab && b.type === 'ASSIST_BLADE');
                    if (abObj?.is_banned) return { valid: false, message: `Contains Banned Assist Blade: ${ab}` };
                }
                if (rc) {
                    const rcObj = resolvedBeys.find(b => b.name === rc && b.type === 'RACHET');
                    if (rcObj?.is_banned) return { valid: false, message: `Contains Banned Rachet: ${rc}` };
                }
                if (bt) {
                    const btObj = resolvedBeys.find(b => b.name === bt && b.type === 'BIT');
                    if (btObj?.is_banned) return { valid: false, message: `Contains Banned Bit: ${bt}` };
                }
            } else {
                // Legacy format
                const specAtt = parts[1];
                const normAtt = parts[2];

                if (specAtt) {
                    const specAttObj = resolvedBeys.find(b => b.name === specAtt && (b.type === 'CX_SPECIAL' || b.type === 'LOCK_CHIP' || b.type === 'ASSIST_BLADE'));
                    if (specAttObj?.is_banned) {
                        return { valid: false, message: `Contains Banned CX Attachment: ${specAtt}` };
                    }
                }

                if (normAtt) {
                    const normAttObj = resolvedBeys.find(b => b.name === normAtt && (b.type === 'NORMAL_ATTACHMENT' || b.type === 'RACHET' || b.type === 'BIT'));
                    if (normAttObj?.is_banned) {
                        return { valid: false, message: `Contains Banned Attachment: ${normAtt}` };
                    }
                }
            }
        }
    }

    // Check Points if Under10 or Under10Custom
    if (mode === "Under10" || mode === "Under10Custom") {
        const pointsMap: Record<string, number> = {};
        resolvedBeys.forEach(b => {
            pointsMap[b.name] = b.points_standard;
        });

        let calculatedPoints = cleanBeys.reduce((sum: number, name: string, idx: number) => {
            let pt = pointsMap[name] || 0;
            
            if (mode === "Under10Custom" && mainBeys[idx] && mainBeys[idx].includes('|')) {
                const parts = mainBeys[idx].split('|');
                const isCX = name && (resolvedBeys.find(b => b.name === name)?.type === 'CX' || beySeries.series.CX.includes(name));

                if (parts.length >= 4) {
                    const lc = parts[1];
                    const ab = parts[2];
                    const rc = parts[3];
                    const bt = parts[4];

                    if (lc && cxEnabled && isCX) {
                        const lcObj = resolvedBeys.find(b => b.name === lc && b.type === 'LOCK_CHIP');
                        if (lcObj) pt += lcObj.points_standard;
                    }
                    if (ab && cxEnabled && isCX) {
                        const abObj = resolvedBeys.find(b => b.name === ab && b.type === 'ASSIST_BLADE');
                        if (abObj) pt += abObj.points_standard;
                    }
                    if (rc) {
                        const rcObj = resolvedBeys.find(b => b.name === rc && b.type === 'RACHET');
                        if (rcObj) pt += rcObj.points_standard;
                    }
                    if (bt) {
                        const btObj = resolvedBeys.find(b => b.name === bt && b.type === 'BIT');
                        if (btObj) pt += btObj.points_standard;
                    }
                } else {
                    const specAttachment = parts[1];
                    const normAttachment = parts[2];

                    if (specAttachment && cxEnabled && isCX) {
                        const specAttObj = resolvedBeys.find(b => b.name === specAttachment && (b.type === 'CX_SPECIAL' || b.type === 'LOCK_CHIP' || b.type === 'ASSIST_BLADE'));
                        if (specAttObj) {
                            pt += specAttObj.points_standard;
                        }
                    }

                    if (normAttachment) {
                        const normAttObj = resolvedBeys.find(b => b.name === normAttachment && (b.type === 'NORMAL_ATTACHMENT' || b.type === 'RACHET' || b.type === 'BIT'));
                        if (normAttObj) {
                            pt += normAttObj.points_standard;
                        }
                    }
                }
            }
            return sum + pt;
        }, 0);

        if (calculatedPoints > 10) {
            return { valid: false, message: `Total Points ${calculatedPoints} exceeds limit.` };
        }
    }

    return { valid: true };
}

// Retry Helper
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0) {
            const isRateLimit = error.response?.status === 429 || error.code === 429 || error.message?.includes("429");
            const isServerErr = error.response?.status >= 500;

            if (isRateLimit || isServerErr) {
                console.warn(`API Error ${error.code || error.response?.status}, Retrying in ${delay}ms... (${retries} left)`);
                await new Promise(r => setTimeout(r, delay));
                return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
            }
        }
        throw error;
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            deviceUUID,
            playerName,
            mode,
            mainBeys,
            totalPoints,
            tournamentId,
            transferFrom
        } = body;

        if (!tournamentId) throw new Error("Missing Tournament ID");

        // 1. Fetch Tournament Status and owner user_id to prevent race conditions
        const { data: tournament, error: tournamentError } = await supabaseAdmin
            .from('tournaments')
            .select('status, challonge_url, user_id, type')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return NextResponse.json({ success: false, message: "Tournament not found" }, { status: 404 });
        }

        // 2. Fetch Beyblade Catalog and Overrides to resolve points / bans
        const { data: beyblades, error: bErr } = await supabaseAdmin
            .from('beyblades')
            .select('*');

        if (bErr || !beyblades) throw new Error("Could not fetch Beyblade catalog");

        // Fetch tournament owner's cx_enabled setting
        const { data: ownerUser } = await supabaseAdmin
            .from('users')
            .select('cx_enabled')
            .eq('id', tournament.user_id)
            .single();

        const cxEnabled = ownerUser?.cx_enabled ?? true;

        const { data: overrides, error: oErr } = await supabaseAdmin
            .from('user_beyblade_points')
            .select('*')
            .eq('user_id', tournament.user_id);

        const isCustomPointMode = tournament.type === 'U10Custom';

        // Resolve merged points
        const resolved = beyblades.map((b: any) => {
            const o = overrides?.find((up: any) => up.beyblade_id === b.id);
            return {
                name: b.name,
                type: b.type || 'BX',
                points_standard: isCustomPointMode && o?.points_standard !== undefined && o?.points_standard !== null 
                    ? o.points_standard 
                    : b.points_standard,
                is_banned: o?.is_banned !== undefined && o?.is_banned !== null ? o.is_banned : b.is_banned
            };
        });

        const resolvedBans = resolved.filter(b => b.is_banned).map(b => b.name);

        // 3. Validate Unique Beys in Deck
        const uniqueMain = new Set(mainBeys);
        if ((uniqueMain.size !== 3) && mode !== "Unlimited" && mode !== "Standard") {
            if (uniqueMain.size !== 3) {
                return NextResponse.json({ success: false, message: "Main Deck must use 3 unique Blades." }, { status: 400 });
            }
        }

        const validation = validatePayloadDb(body, resolved, resolvedBans, cxEnabled);
        if (!validation.valid) {
            return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
        }

        if (tournament.status === 'COMPLETED' || tournament.status === 'CLOSED') {
            return NextResponse.json({ success: false, message: "ทัวร์นาเมนต์จบแล้ว ไม่สามารถแก้ไขได้" }, { status: 400 });
        }

        if (tournament.status === 'STARTED') {
            // Check if this player already exists for THIS device OR transferFrom
            const { data: existing } = await supabaseAdmin
                .from('registrations')
                .select('id, device_uuid')
                .eq('tournament_id', tournamentId)
                .ilike('player_name', playerName.trim())
                .maybeSingle();

            if (!existing) {
                return NextResponse.json({ success: false, message: "ไม่สามารถเพิ่มผู้เล่นใหม่ได้ เนื่องจากเริ่มการแข่งแล้ว" }, { status: 400 });
            }

            // Verify authorization
            const isAuthorized = existing.device_uuid === deviceUUID || 
                               (transferFrom && existing.device_uuid === transferFrom);
            
            if (!isAuthorized) {
                return NextResponse.json({ success: false, message: "Player already registered by another device." }, { status: 403 });
            }
        }

        const registrationData = {
            tournament_id: tournamentId,
            player_name: playerName.trim(),
            device_uuid: deviceUUID,
            mode: mode,
            main_deck: [mainBeys[0], mainBeys[1], mainBeys[2]],
            transferFrom
        };

        // repository.upsertRegistration handles update vs insert
        await withRetry(() => upsertRegistration(registrationData));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Registration Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');
    const deviceUUID = searchParams.get('deviceUUID');
    const checkName = searchParams.get('checkName');
    const listPlayers = searchParams.get('listPlayers');

    if (!tournamentId) {
        return NextResponse.json({ success: false, message: "Missing Tournament ID" }, { status: 400 });
    }

    try {
        if (listPlayers) {
            const { data, error } = await supabaseAdmin
                .from('registrations')
                .select('player_name')
                .eq('tournament_id', tournamentId)
                .order('player_name', { ascending: true });

            if (error) throw error;
            return NextResponse.json({
                success: true,
                players: data.map((d: any) => d.player_name)
            });
        }

        if (checkName) {
            const { data, error } = await supabaseAdmin
                .from('registrations')
                .select('id')
                .eq('tournament_id', tournamentId)
                .ilike('player_name', checkName) // Case insensitive check
                .limit(1);

            if (error) throw error;
            return NextResponse.json({ exists: data && data.length > 0 });
        }

        if (deviceUUID) {
            const { data, error } = await supabaseAdmin
                .from('registrations')
                .select('*')
                .eq('tournament_id', tournamentId)
                .eq('device_uuid', deviceUUID)
                .order('timestamp', { ascending: true }); // Show oldest first (Player 1, 2, 3...)

            if (error) throw error;

            return NextResponse.json({ success: true, data: data });
        }

        return NextResponse.json({ success: false, message: "Invalid parameters" }, { status: 400 });

    } catch (error: any) {
        console.error("GET Registration Error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
