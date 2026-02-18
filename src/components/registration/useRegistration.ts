"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import gameData from "@/data/game-data.json";
import gameDataStandard from "@/data/game-data-standard.json";
import gameDataSouth from "@/data/game-data-south.json";
import cxAttachments from "@/data/cx-attachments.json";
import beySeries from "@/data/bey-series.json";

export type RegistrationMode = "Under10" | "Under10South" | "NoMoreMeta" | "Standard";

export type Profile = {
    internalId: number;
    id?: string;
    name: string;
    mode: RegistrationMode;
    mainBeys: string[];
    mainBeyAttachments: (string | null)[]; // CX attachments for main deck (Heavy, Wheel, or null)
    reserveDecks: string[][];
    reserveDeckAttachments: (string | null)[][]; // CX attachments for reserve decks
    status: 'draft' | 'submitted';
    errorMsg?: string;
    validationPoints?: number;
};

const allBeys = Object.entries(gameData.points).flatMap(([point, names]) =>
    names.map((name) => ({ name, point: parseInt(point) }))
);

const getModeFromType = (type?: string): RegistrationMode => {
    if (type === 'U10') return 'Under10';
    if (type === 'U10South') return 'Under10South';
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
            mainBeyAttachments: [null, null, null],
            reserveDecks: [],
            reserveDeckAttachments: [],
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
                        const loadedProfiles = json.data.map((r: any, idx: number) => {
                            // Parse Main Deck
                            const mainBeys: string[] = [];
                            const mainAttachments: (string | null)[] = [];
                            (r.main_deck || []).forEach((item: string) => {
                                if (item && item.includes('|')) {
                                    const parts = item.split('|');
                                    mainBeys.push(parts[0]);
                                    mainAttachments.push(parts[1] || null);
                                } else {
                                    mainBeys.push(item || "");
                                    mainAttachments.push(null);
                                }
                            });
                            // Ensure length 3
                            while (mainBeys.length < 3) mainBeys.push("");
                            while (mainAttachments.length < 3) mainAttachments.push(null);

                            // Parse Reserve Decks
                            const reserveDecks: string[][] = [];
                            const reserveAttachments: (string | null)[][] = [];

                            (r.reserve_decks || []).forEach((deck: string[]) => {
                                const dBeys: string[] = [];
                                const dAtt: (string | null)[] = [];
                                deck.forEach((item: string) => {
                                    if (item && item.includes('|')) {
                                        const parts = item.split('|');
                                        dBeys.push(parts[0]);
                                        dAtt.push(parts[1] || null);
                                    } else {
                                        dBeys.push(item || "");
                                        dAtt.push(null);
                                    }
                                });
                                // Ensure length 3
                                while (dBeys.length < 3) dBeys.push("");
                                while (dAtt.length < 3) dAtt.push(null);

                                reserveDecks.push(dBeys);
                                reserveAttachments.push(dAtt);
                            });

                            return {
                                internalId: idx + 1,
                                id: r.id,
                                name: r.player_name,
                                mode: r.mode,
                                mainBeys: mainBeys,
                                mainBeyAttachments: mainAttachments,
                                reserveDecks: reserveDecks,
                                reserveDeckAttachments: reserveAttachments,
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

    const validateDeck = (deck: string[], mode: RegistrationMode, attachments?: (string | null)[]) => {
        let currentPoints = 0;

        // Calculate points if U10/U10South (even if incomplete)
        if (mode === "Under10" || mode === "Under10South") {
            const pointData = mode === "Under10South" ? gameDataSouth : gameDataStandard;
            const modeAllBeys = Object.entries(pointData.points).flatMap(([point, names]) =>
                names.map((name) => ({ name, point: parseInt(point) }))
            );

            const total = deck.reduce((sum, name) => {
                if (!name) return sum;
                const b = modeAllBeys.find(x => x.name === name);
                return sum + (b?.point || 0);
            }, 0);

            // Add CX attachment points for U10South mode only
            let attachmentPoints = 0;
            if (mode === "Under10South" && attachments) {
                attachmentPoints = attachments.reduce((sum, attachment) => {
                    if (attachment && (attachment === "Heavy" || attachment === "Wheel")) {
                        return sum + 1; // Each attachment adds +1 point
                    }
                    return sum;
                }, 0);
            }
            currentPoints = total + attachmentPoints;
        }

        if (mode === "Standard") return { valid: true, message: "", points: 0 };

        // 1. Full
        if (deck.some(b => !b)) return { valid: false, message: t('reg.validation.incomplete'), points: currentPoints };
        // 2. Unique
        if (new Set(deck).size !== 3) return { valid: false, message: t('reg.validation.duplicate'), points: currentPoints };

        // 3. Point Limit
        if ((mode === "Under10" || mode === "Under10South") && currentPoints > 10) {
            return { valid: false, message: t('reg.validation.points', { pts: currentPoints }), points: currentPoints };
        }

        if (mode === "NoMoreMeta") {
            // Check banned
            const effectiveBanList = (banList && banList.length > 0) ? banList : gameData.banList;
            const banned = deck.filter(name => effectiveBanList.includes(name));
            if (banned.length > 0) return { valid: false, message: t('reg.validation.banned'), points: currentPoints };
        }

        return { valid: true, message: "", points: currentPoints };
    };

    const validateProfile = (p: Profile) => {
        const mainVal = validateDeck(p.mainBeys, p.mode, p.mainBeyAttachments);
        if (!mainVal.valid) return { valid: false, section: t('reg.deck.main'), message: mainVal.message, points: mainVal.points };

        for (let i = 0; i < p.reserveDecks.length; i++) {
            const resVal = validateDeck(p.reserveDecks[i], p.mode, p.reserveDeckAttachments[i]);
            if (!resVal.valid) return { valid: false, section: t('reg.deck.reserve_item', { n: i + 1 }), message: resVal.message, points: resVal.points };
        }
        return { valid: true, section: "", message: "", points: mainVal.points };
    };

    const validateAllProfiles = () => {
        const updated = profiles.map(p => {
            if (p.status === 'submitted') return p;
            if (!p.name.trim()) return { ...p, errorMsg: 'Please enter player name', validationPoints: undefined };

            const mainVal = validateDeck(p.mainBeys, p.mode, p.mainBeyAttachments);
            if (!mainVal.valid) return { ...p, errorMsg: mainVal.message, validationPoints: mainVal.points };

            for (let i = 0; i < p.reserveDecks.length; i++) {
                const resVal = validateDeck(p.reserveDecks[i], p.mode, p.reserveDeckAttachments[i]);
                if (!resVal.valid) return { ...p, errorMsg: `${t('reg.deck.reserve')} ${i + 1}: ${resVal.message}`, validationPoints: resVal.points };
            }

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

            // Reset attachment for this slot
            const newAttachments = [...profile.mainBeyAttachments];
            newAttachments[selectingState.slotIndex] = null;

            updateProfile(pIndex, { mainBeys: newBeys, mainBeyAttachments: newAttachments });
        } else {
            const newDecks = [...profile.reserveDecks];
            newDecks[selectingState.deckIndex][selectingState.slotIndex] = val;

            // Reset attachment for this slot
            const newAttachments = [...profile.reserveDeckAttachments];
            if (newAttachments[selectingState.deckIndex]) {
                const deckAttachments = [...newAttachments[selectingState.deckIndex]];
                deckAttachments[selectingState.slotIndex] = null;
                newAttachments[selectingState.deckIndex] = deckAttachments;
                updateProfile(pIndex, { reserveDecks: newDecks, reserveDeckAttachments: newAttachments });
            } else {
                updateProfile(pIndex, { reserveDecks: newDecks });
            }
        }
        setSelectingState(null);
    };

    const handleAttachmentSelect = (pIndex: number, type: 'main' | 'reserve', deckIndex: number, slotIndex: number, attachment: string | null) => {
        const profile = profiles[pIndex];

        if (type === 'main') {
            const newAttachments = [...profile.mainBeyAttachments];
            newAttachments[slotIndex] = attachment;
            updateProfile(pIndex, { mainBeyAttachments: newAttachments });
        } else {
            const newAttachments = [...profile.reserveDeckAttachments];
            if (!newAttachments[deckIndex]) {
                newAttachments[deckIndex] = [null, null, null];
            }
            newAttachments[deckIndex][slotIndex] = attachment;
            updateProfile(pIndex, { reserveDeckAttachments: newAttachments });
        }
    };

    const handleReset = (pIndex: number, type: 'main' | 'reserve', deckIndex: number = 0) => {
        const profile = profiles[pIndex];
        if (!profile) return;

        if (type === 'main') {
            updateProfile(pIndex, {
                mainBeys: ["", "", ""],
                mainBeyAttachments: [null, null, null]
            });
        }
    };

    const addReserveDeck = (pIndex: number) => {
        const profile = profiles[pIndex];
        if (profile.reserveDecks.length < 3) {
            updateProfile(pIndex, {
                reserveDecks: [...profile.reserveDecks, ["", "", ""]],
                reserveDeckAttachments: [...profile.reserveDeckAttachments, [null, null, null]]
            });
        }
    };

    const removeReserveDeck = (pIndex: number, deckIndex: number) => {
        const profile = profiles[pIndex];
        const newDecks = [...profile.reserveDecks];
        newDecks.splice(deckIndex, 1);

        const newAttachments = [...profile.reserveDeckAttachments];
        newAttachments.splice(deckIndex, 1);

        updateProfile(pIndex, {
            reserveDecks: newDecks,
            reserveDeckAttachments: newAttachments
        });
    };

    const addProfile = () => {
        setProfiles(prev => [...prev, {
            internalId: Math.max(...prev.map(p => p.internalId), 0) + 1,
            name: "",
            mode: getModeFromType(tournamentType),
            mainBeys: ["", "", ""],
            mainBeyAttachments: [null, null, null],
            reserveDecks: [],
            reserveDeckAttachments: [],
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
                else if (tournamentType === 'U10South' && p.mode === 'Under10South') isValidType = true;
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
                    mainBeys: p.mainBeys.map((bey, idx) => {
                        return (bey && p.mainBeyAttachments[idx]) ? `${bey}|${p.mainBeyAttachments[idx]}` : bey;
                    }),
                    reserveDecks: p.reserveDecks.map((deck, dIdx) => {
                        return deck.map((bey, bIdx) => {
                            const attachment = p.reserveDeckAttachments[dIdx]?.[bIdx];
                            return (bey && attachment) ? `${bey}|${attachment}` : bey;
                        });
                    }),
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
        handleAttachmentSelect,
        addReserveDeck,
        removeReserveDeck,
        handleReset,
        updateProfile,
        addProfile,
        deleteProfile, // Assuming 'removeProfile' in instruction meant 'deleteProfile'
        handleSubmit,
        fetchExistingPlayers, // Assuming this should be added as per the Code Edit
        validateProfile,
        validateDeck,
        triggerFetchExistingPlayers,
        closePlayerList: () => setShowPlayerList(false)
    };
}

