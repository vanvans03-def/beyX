"use client";

import { useState, useEffect, useMemo } from "react";
import { VisualSelector } from "@/components/ui/VisualSelector";
import gameData from "@/data/game-data.json";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle, CheckCircle2, ChevronRight, Plus, Trash2, Globe, Eye, X, XCircle } from "lucide-react";
import imageMap from "@/data/image-map.json";
import Image from "next/image";
import { ImageWithLoading } from "@/components/ui/ImageWithLoading";
import { useTranslation } from "@/hooks/useTranslation";

type RegistrationMode = "Under10" | "NoMoreMeta" | "Standard";

const allBeys = Object.entries(gameData.points).flatMap(([point, names]) =>
    names.map((name) => ({ name, point: parseInt(point) }))
);
allBeys.sort((a, b) => a.name.localeCompare(b.name));

// Helper to render a generic Blade Slot
// Moved outside to prevent re-creation on every render (fixes flickering)
const BladeSlot = ({
    name,
    type,
    deckIndex = 0,
    slotIndex,
    mode,
    onPress,
    banList,
    t
}: {
    name: string,
    type: 'main' | 'reserve',
    deckIndex?: number,
    slotIndex: number,
    mode: RegistrationMode | "Standard",
    onPress: () => void,
    banList?: string[],
    t: any
}) => {
    // @ts-ignore
    const imgPath = imageMap[name];
    const pt = allBeys.find(b => b.name === name)?.point;

    const effectiveBanList = (banList && banList.length > 0) ? banList : gameData.banList;
    const isBanned = mode !== "Under10" && mode !== "Standard" && effectiveBanList.includes(name);

    return (
        <button
            type="button"
            onClick={onPress}
            className={cn(
                "relative flex items-center gap-3 p-3 rounded-xl border border-input transition-all w-full text-left group",
                name ? "bg-card/80" : "bg-secondary/30 dashed-border",
                !name && "border-dashed border-2",
                isBanned && "border-destructive bg-destructive/10"
            )}
        >
            <div className="relative w-12 h-12 shrink-0 bg-black/20 rounded-lg overflow-hidden flex items-center justify-center">
                {name && imgPath ? (
                    <ImageWithLoading src={imgPath} alt={name} fill className="object-cover" />
                ) : name ? (
                    <span className="text-[10px] font-bold text-muted-foreground break-all p-1 text-center">{name.substring(0, 3)}</span>
                ) : (
                    <Plus className="h-5 w-5 text-muted-foreground opacity-50" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                {name ? (
                    <>
                        <div className="font-bold text-sm truncate text-foreground">{name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                            {mode === 'Under10' && (
                                <span className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                                    {pt} PTS
                                </span>
                            )}
                            {isBanned && (
                                <span className="text-[10px] text-destructive font-bold uppercase">{t('reg.banned')}</span>
                            )}
                        </div>
                    </>
                ) : (
                    <span className="text-sm font-medium text-muted-foreground">{t('reg.select')}</span>
                )}
            </div>

            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" />
        </button>
    );
};

export default function RegistrationForm({
    tournamentId,
    tournamentName,
    tournamentStatus,
    tournamentType,
    banList,
    challongeUrl
}: {
    tournamentId: string,
    tournamentName?: string,
    tournamentStatus?: string,
    tournamentType?: string,
    banList?: string[],
    challongeUrl?: string
}) {

    // Validation Logic Note:
    // We validate each deck INDIVIDUALLY.
    // Duplicates are allowed ACROSS different decks (e.g. Main vs Reserve 1),
    // but not WITHIN the same deck (e.g. 3 of the same Bey in Main).
    const { t, lang, toggleLang } = useTranslation();
    const [deviceUUID, setDeviceUUID] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false); // Global success (all submitted)
    // const [errorMSG, setErrorMSG] = useState(""); // Per-profile error? Or global? Use toast/alert.

    // View Players Modal State
    const [showPlayerList, setShowPlayerList] = useState(false);
    const [existingPlayers, setExistingPlayers] = useState<string[]>([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    type Profile = {
        internalId: number; // For React keys
        id?: string; // DB ID if submitted
        name: string;
        mode: RegistrationMode;
        mainBeys: string[];
        reserveDecks: string[][];
        status: 'draft' | 'submitted';
        errorMsg?: string;
        validationPoints?: number;
    };

    const [profiles, setProfiles] = useState<Profile[]>([
        { internalId: 1, name: "", mode: "Under10", mainBeys: ["", "", ""], reserveDecks: [], status: 'draft' }
    ]);
    const [activeTab, setActiveTab] = useState(0);

    // Selector State
    const [selectingState, setSelectingState] = useState<{
        profileIndex: number,
        type: 'main' | 'reserve',
        deckIndex: number,
        slotIndex: number
    } | null>(null);

    useEffect(() => {
        let uuid = localStorage.getItem("device_uuid");
        if (!uuid) {
            // Fallback for randomUUID if not available
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

        // Fetch existing registrations for this device
        if (tournamentId) {
            fetch(`/api/register?tournamentId=${tournamentId}&deviceUUID=${uuid}`)
                .then(res => res.json())
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
                        // If all submitted, show success screen? 
                        // User wants to see "Player 1, 2, 3" links.
                        // We will just render the form in "View/Edit" mode (actually View only if locked?).
                        // "reg.locked" implies they can't edit. 
                        // But user wants "add player". So if they visit again, they see list. 
                        // If they are locked, they can still add NEW players?
                        // Let's assume yes? Or maybe lock strictly?
                        // "Check strict registration lock": existing code setAlreadyRegistered(true).
                        // We'll relax this. If they have profiles, we show them. Can they add more? Yes.
                    }
                })
                .catch(err => console.error("Failed to load profiles", err));
        }
    }, [tournamentId]);

    // Force mode based on Tournament Type (Apply to all profiles?)
    useEffect(() => {
        if (tournamentType === 'U10' || tournamentType === 'NoMoreMeta' || tournamentType === 'Standard') {
            setProfiles(prev => prev.map(p => ({ ...p, mode: (tournamentType as RegistrationMode) })));
        }
    }, [tournamentType]);

    // Handle Tournament Closed
    if ((tournamentStatus === 'CLOSED' || tournamentStatus === 'STARTED' || tournamentStatus === 'COMPLETED' || !!challongeUrl) && profiles.length === 0 /* If no existing profiles, show closed */) {
        return (
            <div className="flex flex-col items-center justify-center space-y-6 py-10 animate-in fade-in zoom-in-95 grayscale">
                <div className="rounded-full bg-secondary p-6 ring-4 ring-white/10">
                    <Trash2 className="h-16 w-16 text-muted-foreground" />
                </div>
                <div className="text-center space-y-2 max-w-xs">
                    <h2 className="text-2xl font-bold text-foreground">{t('reg.closed')}</h2>
                    <p className="text-muted-foreground">{t('reg.closed.desc')}</p>
                </div>
            </div>
        );
    }

    const validateDeck = (deck: string[], mode: RegistrationMode) => {
        // 1. Full
        if (deck.some(b => !b)) return { valid: false, message: t('reg.validation.incomplete') };
        // 2. Unique
        if (new Set(deck).size !== 3) return { valid: false, message: t('reg.validation.duplicate') };

        if (mode === "Standard") return { valid: true, message: "" };

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

    const updateProfile = (index: number, updates: Partial<Profile>) => {
        setProfiles(prev => {
            const newProfiles = [...prev];
            newProfiles[index] = { ...newProfiles[index], ...updates };
            return newProfiles;
        });
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
            mode: (tournamentType === 'NoMoreMeta' ? 'NoMoreMeta' : tournamentType === 'Standard' ? 'Standard' : 'Under10'),
            mainBeys: ["", "", ""],
            reserveDecks: [],
            status: 'draft'
        }]);
        setActiveTab(profiles.length); // Switch to new tab
    };

    const deleteProfile = (index: number) => {
        if (profiles.length <= 1) return;
        setProfiles(prev => prev.filter((_, i) => i !== index));
        // If we deleted the active tab, or a tab before it, adjust activeTab
        if (index <= activeTab) {
            setActiveTab(prev => Math.max(0, prev - 1));
        }
    };

    const copyComboFromFirst = (index: number) => {
        if (index === 0) return;
        const source = profiles[0];
        updateProfile(index, {
            mainBeys: [...source.mainBeys],
            reserveDecks: JSON.parse(JSON.stringify(source.reserveDecks)) // Deep copy
        });
    };

    const fetchExistingPlayers = async () => {
        setLoadingPlayers(true);
        try {
            const res = await fetch(`/api/register?tournamentId=${tournamentId}&listPlayers=true`);
            const data = await res.json();
            if (data.success) {
                setExistingPlayers(data.players || []);
            }
        } catch (e) {
            console.error("Failed to list players", e);
        } finally {
            setLoadingPlayers(false);
        }
    };

    const openPlayerList = () => {
        setShowPlayerList(true);
        fetchExistingPlayers();
    };

    const handleSubmit = async () => {
        // 1. Identify all draft profiles
        const draftProfiles = profiles.map((p, index) => ({ ...p, originalIndex: index })).filter(p => p.status === 'draft');
        if (draftProfiles.length === 0) return;

        // 2. Validate ALL draft profiles
        let allValid = true;
        const updates: { index: number, update: Partial<Profile> }[] = [];

        draftProfiles.forEach(p => {
            const validation = validateProfile(p);
            let errorMsg = "";
            if (!validation.valid) {
                errorMsg = `${validation.section}: ${validation.message}`;
            } else if (!p.name.trim()) {
                errorMsg = t('reg.error.name');
            }

            if (errorMsg) {
                allValid = false;
                updates.push({ index: p.originalIndex, update: { errorMsg } });
            } else {
                // Clear any previous error
                updates.push({ index: p.originalIndex, update: { errorMsg: "" } });
            }
        });

        // Apply validation updates (errors or clearing errors)
        if (updates.length > 0) {
            setProfiles(prev => {
                const newProfiles = [...prev];
                updates.forEach(u => {
                    newProfiles[u.index] = { ...newProfiles[u.index], ...u.update };
                });
                return newProfiles;
            });
        }

        if (!allValid) {
            // Optional: visual cue or toast? The red error text on each profile should be enough.
            return;
        }

        // 3. Submit ALL valid draft profiles
        setLoading(true);
        try {
            const results = await Promise.all(draftProfiles.map(async (p) => {
                const validation = validateProfile(p); // Re-calc points if needed
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
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || t('reg.error.failed'));
                return { originalIndex: p.originalIndex, success: true };
            }));

            // Mark all as submitted
            setProfiles(prev => {
                const newProfiles = [...prev];
                results.forEach(r => {
                    newProfiles[r.originalIndex] = { ...newProfiles[r.originalIndex], status: 'submitted' };
                });
                return newProfiles;
            });

            setSuccess(true); // Maybe trigger a confetti or global success message?

        } catch (err: any) {
            // If one failed, we might want to handle partials?
            // For now, just show the error on the active tab or globally?

            // Suppress console error for known blocking messages to avoid alarm
            if (!err.message?.includes("ไม่สามารถลงทะเบียนได้")) {
                console.error("Batch submit error", err);
            }

            // Show error on the currently active profile if it's one of the drafts?
            // Or just a specific error message.
            updateProfile(activeTab, { errorMsg: err.message || t('reg.error.generic') });
        } finally {
            setLoading(false);
        }
    };

    // BladeSlot moved outside
    // const BladeSlot = ...

    const activeProfile = profiles[activeTab];
    const validation = validateProfile(activeProfile);

    // Helper for visual selector
    const currentSelectorDeck = selectingState && profiles[selectingState.profileIndex]
        ? (selectingState.type === 'main' ? profiles[selectingState.profileIndex].mainBeys : profiles[selectingState.profileIndex].reserveDecks[selectingState.deckIndex])
        : [];

    return (
        <div className="pb-24" data-aos="fade-in" suppressHydrationWarning>
            <div className="flex justify-end mb-4">
                <button
                    type="button"
                    onClick={toggleLang}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary text-xs font-medium transition-colors"
                >
                    <Globe className="h-3 w-3" />
                    {lang === 'TH' ? 'EN' : 'ไทย'}
                </button>
            </div>

            {/* Profile Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-4 hide-scrollbar">
                {profiles.map((p, idx) => (
                    <button
                        key={p.internalId}
                        onClick={() => setActiveTab(idx)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border",
                            activeTab === idx
                                ? "bg-primary text-black border-primary shadow-lg shadow-primary/20 scale-105"
                                : "bg-secondary text-muted-foreground border-transparent hover:bg-secondary/80"
                        )}
                    >
                        <span>{p.name || `Player ${idx + 1}`}</span>
                        {p.status === 'submitted' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                    </button>
                ))}

                {/* Add Player Button - Only show if Open */}
                {(!tournamentStatus || tournamentStatus === 'OPEN') && !challongeUrl && (
                    <button
                        onClick={addProfile}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary border border-white/10 text-muted-foreground hover:text-primary hover:border-primary transition-all shrink-0"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Active Profile Form */}
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300" key={activeProfile.internalId}>

                {/* Status Banner */}
                {activeProfile.status === 'submitted' && (
                    <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3 text-green-400">
                        <CheckCircle2 className="h-5 w-5" />
                        <div>
                            <p className="text-sm font-bold">{t('reg.complete')}</p>
                            <p className="text-xs opacity-80">{t('reg.locked')}</p>
                        </div>
                    </div>
                )}

                {/* Registration Closed Banner for existing profiles */}
                {(tournamentStatus === 'STARTED' || tournamentStatus === 'COMPLETED' || tournamentStatus === 'CLOSED' || !!challongeUrl) && activeProfile.status === 'draft' && (
                    <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-center gap-3 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        <div>
                            <p className="text-sm font-bold">Registration Closed</p>
                            <p className="text-xs opacity-80">This tournament has started or ended.</p>
                        </div>
                    </div>
                )}

                {/* Player Info */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider ml-1">
                            {t('reg.player_name')}
                        </label>
                        {profiles.length > 1 && activeProfile.status === 'draft' && (!tournamentStatus || tournamentStatus === 'OPEN') && !challongeUrl && (
                            <button
                                onClick={() => deleteProfile(activeTab)}
                                className="text-xs text-destructive hover:underline flex items-center gap-1"
                            >
                                <Trash2 className="h-3 w-3" /> Remove Player
                            </button>
                        )}

                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={activeProfile.name}
                            onChange={(e) => updateProfile(activeTab, { name: e.target.value })}
                            disabled={activeProfile.status === 'submitted' || (tournamentStatus === 'STARTED' || tournamentStatus === 'COMPLETED' || tournamentStatus === 'CLOSED' || !!challongeUrl)}
                            placeholder={t('reg.placeholder.name')}
                            className="flex-1 rounded-lg border border-input bg-secondary px-4 py-3 font-medium text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50 disabled:opacity-50"
                        />
                        <button
                            type="button"
                            onClick={openPlayerList}
                            className="bg-secondary hover:bg-secondary/80 text-foreground px-3 rounded-lg border border-input transition-colors disabled:opacity-50 flex items-center justify-center"
                            title="View Registered Players"
                        >
                            <Eye className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Copy Combo Button */}
                    {activeTab > 0 && activeProfile.status === 'draft' && (!tournamentStatus || tournamentStatus === 'OPEN') && !challongeUrl && (
                        <button
                            type="button"
                            onClick={() => copyComboFromFirst(activeTab)}
                            className="text-xs text-primary hover:underline flex items-center gap-1 ml-1"
                        >
                            Make combo same as Player 1
                        </button>
                    )}
                </div>

                {/* Mode Selection (Shared or Per Profile? Based on Code, per profile) */}
                {!tournamentType && (
                    <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-xl">
                        <button
                            type="button"
                            disabled={activeProfile.status === 'submitted' || (tournamentStatus === 'STARTED' || tournamentStatus === 'COMPLETED' || tournamentStatus === 'CLOSED' || !!challongeUrl)}
                            onClick={() => updateProfile(activeTab, { mode: "Under10" })}
                            className={cn("py-2.5 text-sm font-bold rounded-lg transition-all", activeProfile.mode === "Under10" ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:bg-background/50")}
                        >
                            {t('reg.mode.u10')}
                        </button>
                        <button
                            type="button"
                            disabled={activeProfile.status === 'submitted' || (tournamentStatus === 'STARTED' || tournamentStatus === 'COMPLETED' || tournamentStatus === 'CLOSED' || !!challongeUrl)}
                            onClick={() => updateProfile(activeTab, { mode: "NoMoreMeta" })}
                            className={cn("py-2.5 text-sm font-bold rounded-lg transition-all", activeProfile.mode === "NoMoreMeta" ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:bg-background/50")}
                        >
                            {t('reg.mode.nmm')}
                        </button>
                    </div>
                )}

                {/* Main Deck - Hide if Standard */}
                {activeProfile.mode !== 'Standard' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-lg font-bold text-foreground">{t('reg.deck.main')}</h3>
                            {activeProfile.mode === "Under10" && (
                                <span className={cn(
                                    "text-sm font-bold px-2 py-0.5 rounded",
                                    (validateDeck(activeProfile.mainBeys, activeProfile.mode).points || 0) <= 10 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
                                )}>
                                    {(validateDeck(activeProfile.mainBeys, activeProfile.mode).points || 0)}/10 pts
                                </span>
                            )}
                        </div>

                        <div className="space-y-2">
                            {activeProfile.mainBeys.map((bey, i) => (
                                <BladeSlot
                                    key={`main-${i}`}
                                    name={bey}
                                    type="main"
                                    slotIndex={i}
                                    mode={activeProfile.mode}
                                    banList={banList}
                                    onPress={() => {
                                        if (activeProfile.status === 'submitted' || (tournamentStatus === 'STARTED' || tournamentStatus === 'COMPLETED' || tournamentStatus === 'CLOSED' || !!challongeUrl)) return;
                                        setSelectingState({ profileIndex: activeTab, type: 'main', deckIndex: 0, slotIndex: i })
                                    }}
                                    t={t}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Reserves - Hide if Standard */}
                {activeProfile.mode !== 'Standard' && (
                    <div className="space-y-6 pt-4 border-t border-border">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-lg font-bold text-foreground">
                                {t('reg.deck.reserve')} <span className="text-xs font-normal text-muted-foreground">({activeProfile.reserveDecks.length}/3)</span>
                            </h3>
                        </div>

                        {activeProfile.reserveDecks.map((deck, dIdx) => {
                            const val = validateDeck(deck, activeProfile.mode);
                            return (
                                <div key={dIdx} className="space-y-2 bg-secondary/10 p-3 rounded-xl border border-border/50">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-muted-foreground uppercase">{t('reg.deck.reserve_item', { n: dIdx + 1 })}</h4>
                                        <div className="flex items-center gap-2">
                                            {activeProfile.mode === "Under10" && (
                                                <span className={cn("text-xs font-bold", val.points! <= 10 ? "text-primary" : "text-destructive")}>
                                                    {val.points}/10
                                                </span>
                                            )}
                                            {activeProfile.status === 'draft' && (!tournamentStatus || tournamentStatus === 'OPEN') && !challongeUrl && (
                                                <button type="button" onClick={() => removeReserveDeck(activeTab, dIdx)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-full">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {deck.map((bey, sIdx) => (
                                        <BladeSlot
                                            key={`res-${dIdx}-${sIdx}`}
                                            name={bey}
                                            type="reserve"
                                            deckIndex={dIdx}
                                            slotIndex={sIdx}
                                            mode={activeProfile.mode}
                                            banList={banList}
                                            onPress={() => {
                                                if (activeProfile.status === 'submitted' || (tournamentStatus === 'STARTED' || tournamentStatus === 'COMPLETED' || tournamentStatus === 'CLOSED' || !!challongeUrl)) return;
                                                setSelectingState({ profileIndex: activeTab, type: 'reserve', deckIndex: dIdx, slotIndex: sIdx })
                                            }}
                                            t={t}
                                        />
                                    ))}
                                </div>
                            );
                        })}

                        {activeProfile.reserveDecks.length < 3 && activeProfile.status === 'draft' && (!tournamentStatus || tournamentStatus === 'OPEN') && !challongeUrl && (
                            <button
                                type="button"
                                onClick={() => addReserveDeck(activeTab)}
                                className="w-full py-4 border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-muted-foreground hover:bg-secondary/50 hover:border-primary/50 hover:text-primary transition-all font-bold"
                            >
                                <Plus className="h-5 w-5" />
                                {t('reg.btn.add_reserve')}
                            </button>
                        )}
                    </div>
                )}

            </div>

            {/* Actions - Moved outside animation wrapper for stability */}
            <div className="sticky bottom-4 z-50 bg-background/95 backdrop-blur-lg p-4 -mx-4 border-t border-border/50 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
                {/* Global Validation Errors - Show errors for ALL profiles here */}
                {profiles.some(p => p.errorMsg) && (
                    <div className="mb-4 space-y-2 animate-in slide-in-from-bottom-2">
                        {profiles.map((p, idx) => p.errorMsg && (
                            <div key={idx} className="flex items-start gap-2 text-sm text-destructive font-bold bg-destructive/10 p-3 rounded-lg border border-destructive/20 shadow-sm">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <div className="flex flex-col">
                                    <span className="underline mb-0.5">{p.name || `Player ${idx + 1}`}</span>
                                    <span className="font-normal opacity-90">{p.errorMsg}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeProfile.status === 'draft' ? (
                    (!tournamentStatus || tournamentStatus === 'OPEN') && !challongeUrl ? (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full relative flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-bold text-black shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                (profiles.filter(p => p.status === 'draft').length > 1
                                    ? `${t('reg.btn.submit')} All (${profiles.filter(p => p.status === 'draft').length})`
                                    : t('reg.btn.submit'))
                            }
                        </button>
                    ) : (
                        <div className="w-full relative flex items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-4 text-sm font-bold text-muted-foreground cursor-not-allowed">
                            <XCircle className="h-4 w-4" /> Registration Closed
                        </div>
                    )
                ) : (
                    <div className="w-full relative flex items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-4 text-sm font-bold text-muted-foreground cursor-not-allowed">
                        <CheckCircle2 className="h-4 w-4" /> Submitted
                    </div>
                )}
            </div>

            {selectingState && (
                <VisualSelector
                    label={selectingState.type === 'main' ? t('reg.selector.main', { n: selectingState.slotIndex + 1 }) : t('reg.selector.reserve', { d: selectingState.deckIndex + 1, n: selectingState.slotIndex + 1 })}
                    value={selectingState.type === 'main'
                        ? (profiles[selectingState.profileIndex]?.mainBeys[selectingState.slotIndex] || "")
                        : (profiles[selectingState.profileIndex]?.reserveDecks[selectingState.deckIndex][selectingState.slotIndex] || "")}
                    onChange={handleSelect}
                    onClose={() => setSelectingState(null)}
                    options={allBeys.map(opt => {
                        const effectiveBanList = (banList && banList.length > 0) ? banList : gameData.banList;
                        const isBanned = activeProfile.mode !== "Under10" && effectiveBanList.includes(opt.name);
                        return {
                            ...opt,
                            blocked: isBanned
                        };
                    })}
                    maxPoint={(() => {
                        if (activeProfile.mode !== 'Under10') return undefined;
                        // Calculate current points for the ACTIVE deck being edited
                        let currentDeck = currentSelectorDeck;

                        const currentTotal = currentDeck.reduce((sum, name, idx) => {
                            if (idx === selectingState.slotIndex) return sum;
                            const p = allBeys.find(b => b.name === name)?.point || 0;
                            return sum + p;
                        }, 0);

                        return 10 - currentTotal;
                    })()}
                />
            )}

            {/* Players List Modal */}
            {showPlayerList && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/20">
                            <h3 className="font-bold text-foreground flex items-center gap-2">
                                <Globe className="h-4 w-4 text-primary" />
                                Registered Players
                            </h3>
                            <button onClick={() => setShowPlayerList(false)} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                            {loadingPlayers ? (
                                <div className="flex flex-col items-center justify-center py-8 space-y-2 text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="text-xs font-medium">Loading...</span>
                                </div>
                            ) : existingPlayers.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    No players registered yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-1">
                                    {existingPlayers.map((name, idx) => (
                                        <div key={idx} className="px-4 py-3 rounded-lg bg-secondary/10 border border-border/50 text-sm font-medium text-foreground flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                                                {idx + 1}
                                            </span>
                                            {name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t border-border bg-secondary/10 text-center">
                            <span className="text-xs text-muted-foreground">Total: {existingPlayers.length} Players</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
