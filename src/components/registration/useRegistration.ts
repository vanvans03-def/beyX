"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import gameData from "@/data/game-data.json";
import gameDataStandard from "@/data/game-data-standard.json";
import gameDataSouth from "@/data/game-data-south.json";
import cxAttachments from "@/data/cx-attachments.json";
import beySeries from "@/data/bey-series.json";

export type RegistrationMode = "Under10" | "Under10Custom" | "NoMoreMeta" | "Standard";

export type Profile = {
    internalId: number;
    id?: string;
    name: string;
    mode: RegistrationMode;
    mainBeys: string[];
    mainBeyLockChips: (string | null)[]; // Lock Chips
    mainBeyAssistBlades: (string | null)[]; // Assist Blades
    mainBeyRachets: (string | null)[]; // Rachets
    mainBeyBits: (string | null)[]; // Bits
    status: 'draft' | 'submitted';
    errorMsg?: string;
    validationPoints?: number;
    originalMainBeys?: string[];
    originalMainBeyLockChips?: (string | null)[];
    originalMainBeyAssistBlades?: (string | null)[];
    originalMainBeyRachets?: (string | null)[];
    originalMainBeyBits?: (string | null)[];
};

const allBeys = Object.entries(gameData.points).flatMap(([point, names]) =>
    names.map((name) => ({ name, point: parseInt(point) }))
);

const getModeFromType = (type?: string): RegistrationMode => {
    if (type === 'U10') return 'Under10';
    if (type === 'U10Custom') return 'Under10Custom';
    if (type === 'NoMoreMeta') return 'NoMoreMeta';
    if (type === 'Standard' || type === 'Open') return 'Standard';
    return 'Under10';
};

// Helper function to check if a Beyblade is from CX Line
const isCXBey = (beyName: string): boolean => {
    return beySeries.series.CX.includes(beyName);
};
// allBeys.sort((a, b) => a.name.localeCompare(b.name)); // Done globally/once usually

export function useRegistration({
    tournamentId,
    tournamentType,
    banList,
    tournamentStatus,
    challongeUrl
}: {
    tournamentId: string,
    tournamentType?: string,
    banList?: string[],
    tournamentStatus?: string,
    challongeUrl?: string
}) {
    const { t, lang, toggleLang } = useTranslation();
    const [deviceUUID, setDeviceUUID] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [editToken, setEditToken] = useState<string | null>(null);

    // Dynamic config states
    const [beybladesList, setBeybladesList] = useState<{ name: string; points_standard: number; is_banned: boolean; image_url: string; type?: string }[]>([]);
    const [dynamicBanList, setDynamicBanList] = useState<string[]>([]);
    const [cxEnabled, setCxEnabled] = useState(true);

    useEffect(() => {
        if (!tournamentId) return;
        fetch(`/api/register/config?tournamentId=${tournamentId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setBeybladesList(data.beyblades);
                    setDynamicBanList(data.banList);
                    if (data.cxEnabled !== undefined) {
                        setCxEnabled(data.cxEnabled);
                    }
                }
            })
            .catch(err => console.error("Failed to load registration configuration:", err));
    }, [tournamentId]);

    // View Players Modal State
    const [showPlayerList, setShowPlayerList] = useState(false);
    const [existingPlayers, setExistingPlayers] = useState<string[]>([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    console.log('[useRegistration DEBUG] tournamentType:', tournamentType, 'mode:', getModeFromType(tournamentType));

    const [profiles, setProfiles] = useState<Profile[]>([
        {
            internalId: 1,
            name: "",
            mode: getModeFromType(tournamentType),
            mainBeys: ["", "", ""],
            mainBeyLockChips: [null, null, null],
            mainBeyAssistBlades: [null, null, null],
            mainBeyRachets: [null, null, null],
            mainBeyBits: [null, null, null],
            status: 'draft'
        }
    ]);
    const [activeTab, setActiveTab] = useState(0);

    // Selector State
    const [selectingState, setSelectingState] = useState<{
        profileIndex: number,
        type: 'main',
        slotIndex: number
    } | null>(null);

    // Sync first player mode when tournamentType loads
    useEffect(() => {
        if (tournamentType && profiles.length === 1 && profiles[0].status === 'draft' && profiles[0].name === "") {
            setProfiles(prev => {
                const newMode = getModeFromType(tournamentType);
                if (prev[0].mode !== newMode) {
                    return [{ ...prev[0], mode: newMode }];
                }
                return prev;
            });
        }
    }, [tournamentType, profiles.length]);

    // Force mode based on Tournament Type for ALL profiles if type changes
    useEffect(() => {
        if (tournamentType) {
            const targetMode = getModeFromType(tournamentType);
            setProfiles(prev => prev.map(p => {
                if (p.mode !== targetMode) return ({ ...p, mode: targetMode });
                return p;
            }));
        }
    }, [tournamentType]);

    // Device UUID and Load Existing
    useEffect(() => {
        // Check for editToken (Transfer Session)
        const params = new URLSearchParams(window.location.search);
        const token = params.get('editToken');
        if (token) setEditToken(token);

        let uuid = localStorage.getItem("device_uuid");
        if (!uuid) {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                uuid = crypto.randomUUID();
            } else {
                uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
            localStorage.setItem("device_uuid", uuid);
        }
        setDeviceUUID(uuid);

        const fetchUUID = token || uuid;

        if (tournamentId) {
            fetch(`/api/register?tournamentId=${tournamentId}&deviceUUID=${fetchUUID}`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to load");
                    return res.text();
                })
                .then(text => {
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        return { success: false, data: [] };
                    }
                })
                .then(json => {
                    if (json.success && json.data.length > 0) {
                        const loadedProfiles = json.data.map((r: any, idx: number) => {
                            // Parse Main Deck
                            const mainBeys: string[] = [];
                            const mainLockChips: (string | null)[] = [];
                            const mainAssistBlades: (string | null)[] = [];
                            const mainRachets: (string | null)[] = [];
                            const mainBits: (string | null)[] = [];

                            (r.main_deck || []).forEach((item: string) => {
                                if (item && item.includes('|')) {
                                    const parts = item.split('|');
                                    mainBeys.push(parts[0]);
                                    
                                    if (parts.length >= 4) {
                                        // New format: Blade|LockChip|AssistBlade|Rachet|Bit
                                        mainLockChips.push(parts[1] || null);
                                        mainAssistBlades.push(parts[2] || null);
                                        mainRachets.push(parts[3] || null);
                                        mainBits.push(parts[4] || null);
                                    } else {
                                        // Legacy format: Blade|SpecialCX|Normal
                                        const spec = parts[1] || null;
                                        const norm = parts[2] || null;

                                        let lockChip: string | null = null;
                                        let assistBlade: string | null = null;
                                        let rachet: string | null = null;
                                        let bit: string | null = null;

                                        if (spec) {
                                            if (spec === 'Heavy' || spec === 'Wheel') {
                                                lockChip = spec;
                                            } else if (spec === 'Valkyrie' || spec === 'Emperor') {
                                                assistBlade = spec;
                                            }
                                        }

                                        if (norm) {
                                            const dbItem = beybladesList.find(x => x.name === norm);
                                            if (dbItem?.type === 'BIT') {
                                                bit = norm;
                                            } else {
                                                rachet = norm;
                                            }
                                        }

                                        mainLockChips.push(lockChip);
                                        mainAssistBlades.push(assistBlade);
                                        mainRachets.push(rachet);
                                        mainBits.push(bit);
                                    }
                                } else {
                                    mainBeys.push(item || "");
                                    mainLockChips.push(null);
                                    mainAssistBlades.push(null);
                                    mainRachets.push(null);
                                    mainBits.push(null);
                                }
                            });

                            // Ensure length 3
                            while (mainBeys.length < 3) mainBeys.push("");
                            while (mainLockChips.length < 3) mainLockChips.push(null);
                            while (mainAssistBlades.length < 3) mainAssistBlades.push(null);
                            while (mainRachets.length < 3) mainRachets.push(null);
                            while (mainBits.length < 3) mainBits.push(null);

                            return {
                                internalId: idx + 1,
                                id: r.id,
                                name: r.player_name,
                                mode: r.mode === 'Under10South' ? 'Under10Custom' : r.mode,
                                mainBeys: mainBeys,
                                mainBeyLockChips: mainLockChips,
                                mainBeyAssistBlades: mainAssistBlades,
                                mainBeyRachets: mainRachets,
                                mainBeyBits: mainBits,
                                originalMainBeys: [...mainBeys],
                                originalMainBeyLockChips: [...mainLockChips],
                                originalMainBeyAssistBlades: [...mainAssistBlades],
                                originalMainBeyRachets: [...mainRachets],
                                originalMainBeyBits: [...mainBits],
                                status: 'submitted'
                            };
                        });
                        setProfiles(loadedProfiles);
                    }
                })
                .catch(err => console.error("Failed to load profiles", err));
        }
    }, [tournamentId]);

    const updateProfile = (index: number, updates: Partial<Profile>) => {
        setProfiles(prev => {
            const newProfiles = [...prev];
            newProfiles[index] = { ...newProfiles[index], ...updates };
            return newProfiles;
        });
    };

    const validateDeck = (
        deck: string[],
        mode: RegistrationMode,
        lockChips?: (string | null)[],
        assistBlades?: (string | null)[],
        rachets?: (string | null)[],
        bits?: (string | null)[]
    ) => {
        let currentPoints = 0;

        // Calculate points if U10 (even if incomplete)
        if (mode === "Under10" || mode === "Under10Custom") {
            const total = deck.reduce((sum, name, idx) => {
                if (!name) return sum;
                let pt = 0;
                if (beybladesList.length > 0) {
                    const b = beybladesList.find(x => x.name === name);
                    pt = b ? b.points_standard : 0;
                } else {
                    const pointData = mode === "Under10Custom" ? gameDataSouth : gameDataStandard;
                    const modeAllBeys = Object.entries(pointData.points).flatMap(([point, names]) =>
                        names.map((name) => ({ name, point: parseInt(point) }))
                    );
                    const b = modeAllBeys.find(x => x.name === name);
                    pt = b?.point || 0;
                }

                const isCX = name && (beybladesList.find(x => x.name === name)?.type === 'CX' || beySeries.series.CX.includes(name));

                // Add points from Special CX Lock Chip (if enabled and client/blade is CX)
                if (mode === "Under10Custom" && cxEnabled && isCX && lockChips && lockChips[idx]) {
                    const att = lockChips[idx];
                    if (beybladesList.length > 0) {
                        const attObj = beybladesList.find(x => x.name === att && x.type === 'LOCK_CHIP');
                        if (attObj) {
                            pt += attObj.points_standard;
                        }
                    } else {
                        if (att === 'Heavy' || att === 'Wheel') {
                            pt += 1;
                        }
                    }
                }

                // Add points from Special CX Assist Blade (if enabled and client/blade is CX)
                if (mode === "Under10Custom" && cxEnabled && isCX && assistBlades && assistBlades[idx]) {
                    const att = assistBlades[idx];
                    if (beybladesList.length > 0) {
                        const attObj = beybladesList.find(x => x.name === att && x.type === 'ASSIST_BLADE');
                        if (attObj) {
                            pt += attObj.points_standard;
                        }
                    } else {
                        if (att === 'Valkyrie' || att === 'Emperor') {
                            pt += 1;
                        }
                    }
                }

                // Add points from Rachet
                if (mode === "Under10Custom" && rachets && rachets[idx]) {
                    const att = rachets[idx];
                    if (beybladesList.length > 0) {
                        const attObj = beybladesList.find(x => x.name === att && x.type === 'RACHET');
                        if (attObj) {
                            pt += attObj.points_standard;
                        }
                    }
                }

                // Add points from Bit
                if (mode === "Under10Custom" && bits && bits[idx]) {
                    const att = bits[idx];
                    if (beybladesList.length > 0) {
                        const attObj = beybladesList.find(x => x.name === att && x.type === 'BIT');
                        if (attObj) {
                            pt += attObj.points_standard;
                        }
                    }
                }

                return sum + pt;
            }, 0);

            currentPoints = total;
        }

        // Uniqueness check for attachments across all 3 blades in the deck
        const usedAttachments: string[] = [];
        for (let idx = 0; idx < deck.length; idx++) {
            const name = deck[idx];
            if (!name) continue;

            const isCX = name && (beybladesList.find(x => x.name === name)?.type === 'CX' || beySeries.series.CX.includes(name));

            if (isCX) {
                const lc = lockChips?.[idx];
                if (lc) usedAttachments.push(lc);

                const ab = assistBlades?.[idx];
                if (ab) usedAttachments.push(ab);
            }

            const rc = rachets?.[idx];
            if (rc) usedAttachments.push(rc);

            const bt = bits?.[idx];
            if (bt) usedAttachments.push(bt);
        }

        const duplicates = usedAttachments.filter((item, index) => usedAttachments.indexOf(item) !== index);
        if (duplicates.length > 0) {
            return { 
                valid: false, 
                message: t('reg.validation.duplicate_attachment', { name: duplicates[0] }) || `ชิ้นส่วนเสริม ${duplicates[0]} ถูกใช้งานซ้ำในเด็ค`, 
                points: currentPoints 
            };
        }

        if (mode === "Standard") return { valid: true, message: "", points: 0 };

        // 1. Full
        if (deck.some(b => !b)) return { valid: false, message: t('reg.validation.incomplete'), points: currentPoints };
        // 2. Unique
        if (new Set(deck).size !== 3) return { valid: false, message: t('reg.validation.duplicate'), points: currentPoints };

        // 3. Point Limit
        if ((mode === "Under10" || mode === "Under10Custom") && currentPoints > 10) {
            return { valid: false, message: t('reg.validation.points', { pts: currentPoints }), points: currentPoints };
        }

        if (mode === "NoMoreMeta") {
            const fallbackBans = (banList && banList.length > 0) ? banList : gameData.banList;
            const effectiveBanList = (beybladesList.length > 0) ? dynamicBanList : fallbackBans;
            const banned = deck.filter(name => effectiveBanList.includes(name));
            if (banned.length > 0) return { valid: false, message: t('reg.validation.banned'), points: currentPoints };
        }

        return { valid: true, message: "", points: currentPoints };
    };

    const validateProfile = (p: Profile) => {
        const mainVal = validateDeck(p.mainBeys, p.mode, p.mainBeyLockChips, p.mainBeyAssistBlades, p.mainBeyRachets, p.mainBeyBits);
        if (!mainVal.valid) return { valid: false, section: t('reg.deck.main'), message: mainVal.message, points: mainVal.points };

        return { valid: true, section: "", message: "", points: mainVal.points };
    };

    const validateAllProfiles = () => {
        const updated = profiles.map(p => {
            if (p.status === 'submitted') return p;
            if (!p.name.trim()) return { ...p, errorMsg: 'Please enter player name', validationPoints: undefined };

            const mainVal = validateDeck(p.mainBeys, p.mode, p.mainBeyLockChips, p.mainBeyAssistBlades, p.mainBeyRachets, p.mainBeyBits);
            if (!mainVal.valid) return { ...p, errorMsg: mainVal.message, validationPoints: mainVal.points };

            return { ...p, errorMsg: undefined, validationPoints: mainVal.points };
        });
        setProfiles(updated);
        return updated.every(p => !p.errorMsg);
    };

    const handleSelect = (val: string) => {
        if (!selectingState) return;
        const pIndex = selectingState.profileIndex;
        const profile = profiles[pIndex];
        if (!profile) return;

        if (selectingState.type === 'main') {
            const newBeys = [...profile.mainBeys];
            newBeys[selectingState.slotIndex] = val;

            const newLockChips = [...(profile.mainBeyLockChips || [null, null, null])];
            newLockChips[selectingState.slotIndex] = null;

            const newAssistBlades = [...(profile.mainBeyAssistBlades || [null, null, null])];
            newAssistBlades[selectingState.slotIndex] = null;

            const newRachets = [...(profile.mainBeyRachets || [null, null, null])];
            newRachets[selectingState.slotIndex] = null;

            const newBits = [...(profile.mainBeyBits || [null, null, null])];
            newBits[selectingState.slotIndex] = null;

            updateProfile(pIndex, { 
                mainBeys: newBeys, 
                mainBeyLockChips: newLockChips,
                mainBeyAssistBlades: newAssistBlades,
                mainBeyRachets: newRachets,
                mainBeyBits: newBits
            });
        }
        setSelectingState(null);
    };

    const handleAttachmentSelect = (
        pIndex: number, 
        type: 'main', 
        deckIndex: number, 
        slotIndex: number, 
        attachment: string | null,
        attType: 'lock_chip' | 'assist_blade' | 'rachet' | 'bit'
    ) => {
        const profile = profiles[pIndex];
        if (!profile || type !== 'main') return;

        if (attType === 'lock_chip') {
            const newArr = [...(profile.mainBeyLockChips || [null, null, null])];
            newArr[slotIndex] = attachment;
            updateProfile(pIndex, { mainBeyLockChips: newArr });
        } else if (attType === 'assist_blade') {
            const newArr = [...(profile.mainBeyAssistBlades || [null, null, null])];
            newArr[slotIndex] = attachment;
            updateProfile(pIndex, { mainBeyAssistBlades: newArr });
        } else if (attType === 'rachet') {
            const newArr = [...(profile.mainBeyRachets || [null, null, null])];
            newArr[slotIndex] = attachment;
            updateProfile(pIndex, { mainBeyRachets: newArr });
        } else if (attType === 'bit') {
            const newArr = [...(profile.mainBeyBits || [null, null, null])];
            newArr[slotIndex] = attachment;
            updateProfile(pIndex, { mainBeyBits: newArr });
        }
    };

    const handleReset = (pIndex: number, type: 'main', deckIndex: number = 0) => {
        const profile = profiles[pIndex];
        if (!profile) return;

        if (type === 'main') {
            updateProfile(pIndex, {
                mainBeys: ["", "", ""],
                mainBeyLockChips: [null, null, null],
                mainBeyAssistBlades: [null, null, null],
                mainBeyRachets: [null, null, null],
                mainBeyBits: [null, null, null]
            });
        }
    };

    const addProfile = () => {
        setProfiles(prev => [...prev, {
            internalId: Math.max(...prev.map(p => p.internalId), 0) + 1,
            name: "",
            mode: getModeFromType(tournamentType),
            mainBeys: ["", "", ""],
            mainBeyLockChips: [null, null, null],
            mainBeyAssistBlades: [null, null, null],
            mainBeyRachets: [null, null, null],
            mainBeyBits: [null, null, null],
            status: 'draft'
        }]);
        setActiveTab(profiles.length);
    };

    const deleteProfile = (index: number) => {
        if (profiles.length <= 1) return;
        setProfiles(prev => prev.filter((_, i) => i !== index));
        if (index <= activeTab) {
            setActiveTab(prev => Math.max(0, prev - 1));
        }
    };

    const copyComboFromFirst = (index: number) => {
        if (index === 0) return;
        const source = profiles[0];
        updateProfile(index, {
            mainBeys: [...source.mainBeys]
        });
    };

    const fetchExistingPlayers = async () => {
        setLoadingPlayers(true);
        try {
            const res = await fetch(`/api/register?tournamentId=${tournamentId}&listPlayers=true`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            if (data.success) {
                setExistingPlayers(data.players || []);
                setShowPlayerList(true);
            }
        } catch (e) {
            console.error("Failed to list players", e);
        } finally {
            setLoadingPlayers(false);
        }
    };

    // Explicitly Typed Function to be called from UI
    const triggerFetchExistingPlayers = () => {
        fetchExistingPlayers();
    };

    const handleSubmit = async () => {
        // Only allow submitting if tournament is OPEN or STARTED
        if (tournamentStatus === 'COMPLETED' || tournamentStatus === 'CLOSED') {
            return;
        }

        const activeProfiles = profiles.map((p, index) => ({ ...p, originalIndex: index }));
        if (activeProfiles.length === 0) return;

        let allValid = true;
        const updates: { index: number, update: Partial<Profile> }[] = [];

        activeProfiles.forEach(p => {
            const validation = validateProfile(p);
            let errorMsg = "";
            if (!validation.valid) {
                errorMsg = `${validation.section}: ${validation.message}`;
            } else if (!p.name.trim()) {
                errorMsg = t('reg.error.name');
            } else if (tournamentType && p.mode !== tournamentType && !(tournamentType === 'Open' && p.mode === 'Standard')) {
                let isValidType = false;
                if (tournamentType === 'U10' && p.mode === 'Under10') isValidType = true;
                else if (tournamentType === 'U10Custom' && p.mode === 'Under10Custom') isValidType = true;
                else if (tournamentType === 'NoMoreMeta' && p.mode === 'NoMoreMeta') isValidType = true;
                else if ((tournamentType === 'Open' || tournamentType === 'Standard') && p.mode === 'Standard') isValidType = true;

                if (!isValidType) {
                    errorMsg = `Tournament is ${tournamentType} but player is ${p.mode}`;
                }
            }

            if (errorMsg) {
                allValid = false;
                updates.push({ index: p.originalIndex, update: { errorMsg } });
            } else {
                updates.push({ index: p.originalIndex, update: { errorMsg: "" } });
            }
        });

        if (updates.length > 0) {
            setProfiles(prev => {
                const newProfiles = [...prev];
                updates.forEach(u => {
                    newProfiles[u.index] = { ...newProfiles[u.index], ...u.update };
                });
                return newProfiles;
            });
        }

        if (!allValid) return;

        setLoading(true);
        try {
            const results = await Promise.allSettled(activeProfiles.map(async (p) => {
                const validation = validateProfile(p);
                 const payload = {
                    deviceUUID,
                    playerName: p.name,
                    mode: p.mode,
                    mainBeys: p.mainBeys.map((bey, idx) => {
                        const lc = p.mainBeyLockChips[idx] || "";
                        const ab = p.mainBeyAssistBlades[idx] || "";
                        const rc = p.mainBeyRachets[idx] || "";
                        const bt = p.mainBeyBits[idx] || "";
                        if (lc || ab || rc || bt) {
                            return `${bey}|${lc}|${ab}|${rc}|${bt}`;
                        }
                        return bey;
                    }),
                    totalPoints: validation.points || 0,
                    tournamentId,
                    transferFrom: editToken || undefined
                };

                const res = await fetch("/api/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                let data;
                try {
                    data = await res.json();
                } catch (e) {
                    throw new Error(t('reg.error.failed'));
                }

                if (!res.ok) throw new Error(data.message || t('reg.error.failed'));
                return { originalIndex: p.originalIndex };
            }));

            const updates: { index: number, update: Partial<Profile> }[] = [];
            let submissionCount = 0;

            results.forEach((result, idx) => {
                const originalProfile = activeProfiles[idx];
                if (result.status === 'fulfilled') {
                    updates.push({
                        index: originalProfile.originalIndex,
                        update: { 
                            status: 'submitted', 
                            errorMsg: "",
                            originalMainBeys: [...originalProfile.mainBeys],
                            originalMainBeyLockChips: [...(originalProfile.mainBeyLockChips || [null, null, null])],
                            originalMainBeyAssistBlades: [...(originalProfile.mainBeyAssistBlades || [null, null, null])],
                            originalMainBeyRachets: [...(originalProfile.mainBeyRachets || [null, null, null])],
                            originalMainBeyBits: [...(originalProfile.mainBeyBits || [null, null, null])]
                        }
                    });
                    submissionCount++;
                } else {
                    const msg = result.reason?.message || "Error";
                    let localizedMsg = msg;
                    if (msg.includes("already registered") || msg.includes("ชื่อซ้ำ")) {
                        localizedMsg = t('reg.error.name_exists');
                    }
                    updates.push({
                        index: originalProfile.originalIndex,
                        update: { errorMsg: localizedMsg }
                    });
                }
            });

            setProfiles(prev => {
                const newProfiles = [...prev];
                updates.forEach(u => {
                    newProfiles[u.index] = { ...newProfiles[u.index], ...u.update };
                });
                return newProfiles;
            });

            if (submissionCount > 0 && submissionCount === activeProfiles.length) {
                setSuccess(true);
                if (editToken) {
                    setEditToken(null);
                    // Clean URL
                    try {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('editToken');
                        window.history.replaceState({}, '', url.pathname + url.search);
                    } catch (e) {
                        console.error("Failed to clean URL", e);
                    }
                }
            }

        } catch (err: any) {
            console.error("Batch submit fatal error", err);
            updateProfile(activeTab, { errorMsg: t('reg.error.generic') });
        } finally {
            setLoading(false);
        }
    };

    return {
        // State
        profiles,
        activeTab,
        selectingState,
        loading,
        success,
        showPlayerList,
        existingPlayers,
        loadingPlayers,
        t,
        lang,
        toggleLang,
        beybladesList,
        dynamicBanList,
        cxEnabled,

        // Actions
        setActiveTab,
        setSelectingState,
        setShowPlayerList,
        handleSelect,
        handleAttachmentSelect,
        handleReset,
        updateProfile,
        addProfile,
        deleteProfile,
        handleSubmit,
        fetchExistingPlayers,
        validateProfile,
        validateDeck,
        triggerFetchExistingPlayers,
        closePlayerList: () => setShowPlayerList(false)
    };
}

