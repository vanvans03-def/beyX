"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import gameData from "@/data/game-data.json";

export type RegistrationMode = "Under10" | "NoMoreMeta" | "Standard";

export type Profile = {
    internalId: number;
    id?: string;
    name: string;
    mode: RegistrationMode;
    mainBeys: string[];
    reserveDecks: string[][];
    status: 'draft' | 'submitted';
    errorMsg?: string;
    validationPoints?: number;
};

const allBeys = Object.entries(gameData.points).flatMap(([point, names]) =>
    names.map((name) => ({ name, point: parseInt(point) }))
);

const getModeFromType = (type?: string): RegistrationMode => {
    if (type === 'U10') return 'Under10';
    if (type === 'NoMoreMeta') return 'NoMoreMeta';
    if (type === 'Standard' || type === 'Open') return 'Standard';
    return 'Under10';
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

    // View Players Modal State
    const [showPlayerList, setShowPlayerList] = useState(false);
    const [existingPlayers, setExistingPlayers] = useState<string[]>([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    const [profiles, setProfiles] = useState<Profile[]>([
        {
            internalId: 1,
            name: "",
            mode: getModeFromType(tournamentType),
            mainBeys: ["", "", ""],
            reserveDecks: [],
            status: 'draft'
        }
    ]);
    const [activeTab, setActiveTab] = useState(0);

    // Selector State
    const [selectingState, setSelectingState] = useState<{
        profileIndex: number,
        type: 'main' | 'reserve',
        deckIndex: number,
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

        if (tournamentId) {
            fetch(`/api/register?tournamentId=${tournamentId}&deviceUUID=${uuid}`)
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
                        const loadedProfiles = json.data.map((r: any, idx: number) => ({
                            internalId: idx + 1,
                            id: r.id,
                            name: r.player_name,
                            mode: r.mode,
                            mainBeys: r.main_deck,
                            reserveDecks: r.reserve_decks || [],
                            status: 'submitted'
                        }));
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

    const validateDeck = (deck: string[], mode: RegistrationMode) => {
        if (mode === "Standard") return { valid: true, message: "" };

        // 1. Full
        if (deck.some(b => !b)) return { valid: false, message: t('reg.validation.incomplete') };
        // 2. Unique
        if (new Set(deck).size !== 3) return { valid: false, message: t('reg.validation.duplicate') };

        // 3. Mode
        if (mode === "Under10") {
            const total = deck.reduce((sum, name) => {
                const b = allBeys.find(x => x.name === name);
                return sum + (b?.point || 0);
            }, 0);
            if (total > 10) return { valid: false, message: t('reg.validation.points', { pts: total }), points: total };
            return { valid: true, points: total };
        } else {
            const effectiveBanList = (banList && banList.length > 0) ? banList : gameData.banList;
            const banned = deck.filter(name => effectiveBanList.includes(name));
            if (banned.length > 0) return { valid: false, message: t('reg.validation.banned') };
            return { valid: true, message: "" };
        }
    };

    const validateProfile = (p: Profile) => {
        const mainVal = validateDeck(p.mainBeys, p.mode);
        if (!mainVal.valid) return { valid: false, section: t('reg.deck.main'), message: mainVal.message, points: mainVal.points };

        for (let i = 0; i < p.reserveDecks.length; i++) {
            const resVal = validateDeck(p.reserveDecks[i], p.mode);
            if (!resVal.valid) return { valid: false, section: t('reg.deck.reserve_item', { n: i + 1 }), message: resVal.message, points: resVal.points };
        }
        return { valid: true, section: "", message: "", points: mainVal.points };
    };

    const handleSelect = (val: string) => {
        if (!selectingState) return;
        const pIndex = selectingState.profileIndex;
        const profile = profiles[pIndex];
        if (!profile) return;

        if (selectingState.type === 'main') {
            const newBeys = [...profile.mainBeys];
            newBeys[selectingState.slotIndex] = val;
            updateProfile(pIndex, { mainBeys: newBeys });
        } else {
            const newDecks = [...profile.reserveDecks];
            newDecks[selectingState.deckIndex][selectingState.slotIndex] = val;
            updateProfile(pIndex, { reserveDecks: newDecks });
        }
        setSelectingState(null);
    };

    const addReserveDeck = (pIndex: number) => {
        const profile = profiles[pIndex];
        if (profile.reserveDecks.length < 3) {
            updateProfile(pIndex, { reserveDecks: [...profile.reserveDecks, ["", "", ""]] });
        }
    };

    const removeReserveDeck = (pIndex: number, deckIndex: number) => {
        const profile = profiles[pIndex];
        const newDecks = [...profile.reserveDecks];
        newDecks.splice(deckIndex, 1);
        updateProfile(pIndex, { reserveDecks: newDecks });
    };

    const addProfile = () => {
        setProfiles(prev => [...prev, {
            internalId: Math.max(...prev.map(p => p.internalId), 0) + 1,
            name: "",
            mode: getModeFromType(tournamentType),
            mainBeys: ["", "", ""],
            reserveDecks: [],
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
            mainBeys: [...source.mainBeys],
            reserveDecks: JSON.parse(JSON.stringify(source.reserveDecks))
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
        const draftProfiles = profiles.map((p, index) => ({ ...p, originalIndex: index })).filter(p => p.status === 'draft');
        if (draftProfiles.length === 0) return;

        let allValid = true;
        const updates: { index: number, update: Partial<Profile> }[] = [];

        draftProfiles.forEach(p => {
            const validation = validateProfile(p);
            let errorMsg = "";
            if (!validation.valid) {
                errorMsg = `${validation.section}: ${validation.message}`;
            } else if (!p.name.trim()) {
                errorMsg = t('reg.error.name');
            } else if (tournamentType && p.mode !== tournamentType && !(tournamentType === 'Open' && p.mode === 'Standard')) {
                let isValidType = false;
                if (tournamentType === 'U10' && p.mode === 'Under10') isValidType = true;
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
            const results = await Promise.allSettled(draftProfiles.map(async (p) => {
                const validation = validateProfile(p);
                const payload = {
                    deviceUUID,
                    playerName: p.name,
                    mode: p.mode,
                    mainBeys: p.mainBeys,
                    reserveDecks: p.reserveDecks,
                    totalPoints: validation.points || 0,
                    tournamentId
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
                    // If JSON parse fails (e.g. 500 HTML), throw generic error
                    throw new Error(t('reg.error.failed'));
                }

                if (!res.ok) throw new Error(data.message || t('reg.error.failed'));
                return { originalIndex: p.originalIndex };
            }));

            const updates: { index: number, update: Partial<Profile> }[] = [];
            let submissionCount = 0;

            results.forEach((result, idx) => {
                const originalProfile = draftProfiles[idx];
                if (result.status === 'fulfilled') {
                    updates.push({
                        index: originalProfile.originalIndex,
                        update: { status: 'submitted', errorMsg: "" }
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

            if (submissionCount > 0 && submissionCount === draftProfiles.length) {
                setSuccess(true);
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

        // Actions
        setActiveTab,
        setSelectingState,
        setShowPlayerList,
        handleSelect,
        addReserveDeck,
        removeReserveDeck,
        addProfile,
        deleteProfile,
        copyComboFromFirst,
        updateProfile,
        handleSubmit,
        validateProfile,
        validateDeck,
        triggerFetchExistingPlayers,
        closePlayerList: () => setShowPlayerList(false)
    };
}
