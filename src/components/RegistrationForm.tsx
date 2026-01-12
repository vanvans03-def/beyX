"use client";

import { useState, useEffect, useMemo } from "react";
import { VisualSelector } from "@/components/ui/VisualSelector";
import gameData from "@/data/game-data.json";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle, CheckCircle2, ChevronRight, Plus, Trash2 } from "lucide-react";
import imageMap from "@/data/image-map.json";
import Image from "next/image";

type RegistrationMode = "Under10" | "NoMoreMeta";

const allBeys = Object.entries(gameData.points).flatMap(([point, names]) =>
    names.map((name) => ({ name, point: parseInt(point) }))
);
allBeys.sort((a, b) => a.name.localeCompare(b.name));

export default function RegistrationForm({ tournamentId, tournamentName }: { tournamentId: string, tournamentName?: string }) {
    const [deviceUUID, setDeviceUUID] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMSG, setErrorMSG] = useState("");
    const [alreadyRegistered, setAlreadyRegistered] = useState(false);

    const [playerName, setPlayerName] = useState("");
    const [mode, setMode] = useState<RegistrationMode>("Under10");
    const [mainBeys, setMainBeys] = useState(["", "", ""]);
    // Multi-deck reserves: Array of decks (which are arrays of strings)
    const [reserveDecks, setReserveDecks] = useState<string[][]>([]);

    // Selector State
    // type can be 'main' or 'reserve'
    // if 'reserve', we need deckIndex
    const [selectingState, setSelectingState] = useState<{
        type: 'main' | 'reserve',
        deckIndex: number,
        slotIndex: number
    } | null>(null);

    useEffect(() => {
        let uuid = localStorage.getItem("device_uuid");
        if (!uuid) {
            uuid = crypto.randomUUID();
            localStorage.setItem("device_uuid", uuid);
        }
        setDeviceUUID(uuid);

        // Check strict registration lock for THIS tournament
        const lockKey = `reg_lock_${tournamentId}`;
        if (localStorage.getItem(lockKey)) {
            setAlreadyRegistered(true);
            // Load saved data for display if available? 
            // User said: "Cannot edit". 
            // Maybe just show specific "Already Registered" message.
        }
    }, [tournamentId]);

    const validateDeck = (deck: string[]) => {
        // 1. Full
        if (deck.some(b => !b)) return { valid: false, message: "Incomplete Deck" };
        // 2. Unique
        if (new Set(deck).size !== 3) return { valid: false, message: "Duplicate Blades" };

        // 3. Mode
        if (mode === "Under10") {
            const total = deck.reduce((sum, name) => {
                const b = allBeys.find(x => x.name === name);
                return sum + (b?.point || 0);
            }, 0);
            if (total > 10) return { valid: false, message: `${total}/10 pts`, points: total };
            return { valid: true, points: total };
        } else {
            const banned = deck.filter(name => gameData.banList.includes(name));
            if (banned.length > 0) return { valid: false, message: "Banned Item" };
            return { valid: true, message: "" };
        }
    };

    const validationResult = useMemo(() => {
        // Main Deck
        const mainVal = validateDeck(mainBeys);
        if (!mainVal.valid) return { valid: false, section: "Main Deck", message: mainVal.message, points: mainVal.points };

        // Reserve Decks
        for (let i = 0; i < reserveDecks.length; i++) {
            const resVal = validateDeck(reserveDecks[i]);
            if (!resVal.valid) return { valid: false, section: `Reserve ${i + 1}`, message: resVal.message, points: resVal.points };
        }

        return { valid: true, section: "", message: "", points: mainVal.points };
    }, [mainBeys, reserveDecks, mode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validationResult.valid) return;
        if (!playerName.trim()) {
            setErrorMSG("Please enter your name.");
            return;
        }
        setLoading(true);
        setErrorMSG("");

        try {
            const payload = {
                deviceUUID,
                playerName,
                mode,
                mainBeys,
                reserveDecks,
                totalPoints: validationResult.points || 0,
                tournamentId
            };

            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Registration failed");

            setSuccess(true);
            // Lock this device for this tournament
            localStorage.setItem(`reg_lock_${tournamentId}`, "true");
            // Save data for receipt
            localStorage.setItem(`reg_data_${tournamentId}`, JSON.stringify(payload));

        } catch (err: any) {
            setErrorMSG(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (val: string) => {
        if (!selectingState) return;

        if (selectingState.type === 'main') {
            const newBeys = [...mainBeys];
            newBeys[selectingState.slotIndex] = val;
            setMainBeys(newBeys);
        } else {
            const newDecks = [...reserveDecks];
            newDecks[selectingState.deckIndex][selectingState.slotIndex] = val;
            setReserveDecks(newDecks);
        }
        setSelectingState(null);
    };

    const addReserveDeck = () => {
        if (reserveDecks.length < 3) {
            setReserveDecks([...reserveDecks, ["", "", ""]]);
        }
    };

    const removeReserveDeck = (index: number) => {
        const newDecks = [...reserveDecks];
        newDecks.splice(index, 1);
        setReserveDecks(newDecks);
    };

    // Helper to render a generic Blade Slot
    const BladeSlot = ({
        name,
        type,
        deckIndex = 0,
        slotIndex,
        onPress
    }: { name: string, type: 'main' | 'reserve', deckIndex?: number, slotIndex: number, onPress: () => void }) => {
        // @ts-ignore
        const imgPath = imageMap[name];
        const pt = allBeys.find(b => b.name === name)?.point;
        const isBanned = mode === "NoMoreMeta" && gameData.banList.includes(name);

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
                {/* Image/Icon */}
                <div className="relative w-12 h-12 shrink-0 bg-black/20 rounded-lg overflow-hidden flex items-center justify-center">
                    {name && imgPath ? (
                        <Image src={imgPath} alt={name} fill className="object-cover" />
                    ) : name ? (
                        <span className="text-[10px] font-bold text-muted-foreground break-all p-1 text-center">{name.substring(0, 3)}</span>
                    ) : (
                        <Plus className="h-5 w-5 text-muted-foreground opacity-50" />
                    )}
                </div>

                {/* Info */}
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
                                    <span className="text-[10px] text-destructive font-bold uppercase">Banned</span>
                                )}
                            </div>
                        </>
                    ) : (
                        <span className="text-sm font-medium text-muted-foreground">Select...</span>
                    )}
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" />
            </button>
        );
    };

    if (alreadyRegistered || success) {
        let savedData: any = null;
        try {
            const raw = localStorage.getItem(`reg_data_${tournamentId}`);
            if (raw) savedData = JSON.parse(raw);
        } catch (e) { }

        // Fallback if local storage missing but lock exists (shouldn't happen often)
        if (!savedData) {
            return (
                <div className="flex flex-col items-center justify-center space-y-6 py-10 animate-in fade-in zoom-in-95">
                    <div className="rounded-full bg-green-500/20 p-6 ring-4 ring-green-500/10">
                        <CheckCircle2 className="h-16 w-16 text-green-500" />
                    </div>
                    <div className="text-center space-y-2 max-w-xs">
                        <h2 className="text-2xl font-bold text-foreground">Registered!</h2>
                        <p className="text-muted-foreground">You are registered for this tournament.</p>
                        {tournamentName && <p className="text-sm font-bold text-primary opacity-80">{tournamentName}</p>}
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col space-y-6 py-6 animate-in fade-in zoom-in-95">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-green-500/10 mb-2">
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Registration Complete</h2>
                    {tournamentName && <h3 className="text-lg font-bold text-primary">{tournamentName}</h3>}
                    <p className="text-muted-foreground text-sm">Your entry has been locked.</p>
                </div>

                <div className="space-y-6">
                    {/* Player Card */}
                    <div className="glass-card p-4 rounded-xl border border-white/10 space-y-2">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Player Profile</div>
                        <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-white max-w-[200px] truncate" title={savedData.playerName}>{savedData.playerName}</span>
                            <span className={cn("px-2 py-1 rounded text-xs font-bold", savedData.mode === "Under10" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400")}>
                                {savedData.mode === "Under10" ? "U10" : "NMM"}
                            </span>
                        </div>
                    </div>

                    {/* Main Deck */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Main Deck</h3>
                            {savedData.mode === "Under10" && (
                                <span className="text-xs font-bold text-primary">{savedData.totalPoints}/10 pts</span>
                            )}
                        </div>
                        <div className="space-y-2">
                            {savedData.mainBeys.map((bey: string, i: number) => (
                                // Reusing BladeSlot but non-interactive
                                <div key={i} className="relative flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/50">
                                    <div className="relative w-10 h-10 shrink-0 bg-black/40 rounded-lg overflow-hidden flex items-center justify-center">
                                        {/* @ts-ignore */}
                                        {imageMap[bey] && <Image src={imageMap[bey]} alt={bey} fill className="object-cover" />}
                                    </div>
                                    <div className="font-bold text-sm text-foreground">{bey}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Reserve Decks */}
                    {savedData.reserveDecks && savedData.reserveDecks.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider px-1">Reserve Decks</h3>
                            {savedData.reserveDecks.map((deck: string[], dIdx: number) => (
                                <div key={dIdx} className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/5">
                                    <div className="text-xs font-bold text-muted-foreground mb-2">Deck {dIdx + 1}</div>
                                    {deck.map((bey: string, sIdx: number) => (
                                        <div key={sIdx} className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded bg-black/40 relative overflow-hidden">
                                                {/* @ts-ignore */}
                                                {imageMap[bey] && <Image src={imageMap[bey]} alt={bey} fill className="object-cover" />}
                                            </div>
                                            <span className="text-sm font-medium opacity-80">{bey}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-200/80 text-center">
                    Registration is final. Contact the Tournament Organizer for changes.
                </div>
            </div>
        );
    }

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-8 animate-in slide-in-from-bottom-5 duration-500 pb-20">

                {/* Player Info */}
                <div className="space-y-2">
                    <label htmlFor="playerName" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider ml-1">
                        Player Name
                    </label>
                    <input
                        id="playerName"
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Enter your Display Name"
                        className="w-full rounded-lg border border-input bg-secondary px-4 py-3 font-medium text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                    />
                </div>

                {/* Mode Selection */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-xl">
                    <button type="button" onClick={() => setMode("Under10")} className={cn("py-2.5 text-sm font-bold rounded-lg transition-all", mode === "Under10" ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:bg-background/50")}>U10 (Points)</button>
                    <button type="button" onClick={() => setMode("NoMoreMeta")} className={cn("py-2.5 text-sm font-bold rounded-lg transition-all", mode === "NoMoreMeta" ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:bg-background/50")}>No More Meta</button>
                </div>

                {/* Main Deck */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-lg font-bold text-foreground">Main Deck</h3>
                        {mode === "Under10" && (
                            <span className={cn(
                                "text-sm font-bold px-2 py-0.5 rounded",
                                (validateDeck(mainBeys).points || 0) <= 10 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
                            )}>
                                {(validateDeck(mainBeys).points || 0)}/10 pts
                            </span>
                        )}
                    </div>

                    <div className="space-y-2">
                        {mainBeys.map((bey, i) => (
                            <BladeSlot
                                key={`main-${i}`}
                                name={bey}
                                type="main"
                                slotIndex={i}
                                onPress={() => setSelectingState({ type: 'main', deckIndex: 0, slotIndex: i })}
                            />
                        ))}
                    </div>
                </div>

                {/* Reserves */}
                <div className="space-y-6 pt-4 border-t border-border">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-lg font-bold text-foreground">
                            Reserves <span className="text-xs font-normal text-muted-foreground">({reserveDecks.length}/3)</span>
                        </h3>
                    </div>

                    {reserveDecks.map((deck, dIdx) => {
                        const val = validateDeck(deck);
                        return (
                            <div key={dIdx} className="space-y-2 bg-secondary/10 p-3 rounded-xl border border-border/50">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-muted-foreground uppercase">Reserve Deck {dIdx + 1}</h4>
                                    <div className="flex items-center gap-2">
                                        {mode === "Under10" && (
                                            <span className={cn("text-xs font-bold", val.points! <= 10 ? "text-primary" : "text-destructive")}>
                                                {val.points}/10
                                            </span>
                                        )}
                                        <button type="button" onClick={() => removeReserveDeck(dIdx)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-full">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                {deck.map((bey, sIdx) => (
                                    <BladeSlot
                                        key={`res-${dIdx}-${sIdx}`}
                                        name={bey}
                                        type="reserve"
                                        deckIndex={dIdx}
                                        slotIndex={sIdx}
                                        onPress={() => setSelectingState({ type: 'reserve', deckIndex: dIdx, slotIndex: sIdx })}
                                    />
                                ))}
                            </div>
                        );
                    })}

                    {reserveDecks.length < 3 && (
                        <button
                            type="button"
                            onClick={addReserveDeck}
                            className="w-full py-4 border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-muted-foreground hover:bg-secondary/50 hover:border-primary/50 hover:text-primary transition-all font-bold"
                        >
                            <Plus className="h-5 w-5" />
                            Add Reserve Deck
                        </button>
                    )}
                </div>

                {/* Actions */}
                <div className="sticky bottom-4 z-40 bg-background/80 backdrop-blur-lg p-4 -mx-4 border-t border-border/50 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
                    {!validationResult.valid && (
                        <div className="mb-4 flex items-center gap-2 text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-lg">
                            <AlertTriangle className="h-4 w-4" />
                            {validationResult.section}: {validationResult.message}
                        </div>
                    )}
                    {errorMSG && <div className="mb-4 text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-lg">{errorMSG}</div>}

                    <button
                        type="submit"
                        disabled={!validationResult.valid || loading || !playerName}
                        className="w-full relative flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-bold text-black shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Registration"}
                    </button>
                </div>

            </form>

            {selectingState && (
                <VisualSelector
                    label={selectingState.type === 'main' ? `Main Bey ${selectingState.slotIndex + 1}` : `Res ${selectingState.deckIndex + 1} - Bey ${selectingState.slotIndex + 1}`}
                    value={selectingState.type === 'main'
                        ? mainBeys[selectingState.slotIndex]
                        : reserveDecks[selectingState.deckIndex][selectingState.slotIndex]}
                    onChange={handleSelect}
                    onClose={() => setSelectingState(null)}
                    options={allBeys.map(opt => ({
                        ...opt,
                        blocked: false // Only hard block if needed, let validation handle soft limits
                    }))}
                    maxPoint={(() => {
                        if (mode !== 'Under10') return undefined;
                        // Calculate current points for the ACTIVE deck being edited
                        let currentDeck = selectingState.type === 'main' ? mainBeys : reserveDecks[selectingState.deckIndex];

                        const currentTotal = currentDeck.reduce((sum, name, idx) => {
                            if (idx === selectingState.slotIndex) return sum;
                            const p = allBeys.find(b => b.name === name)?.point || 0;
                            return sum + p;
                        }, 0);

                        return 10 - currentTotal;
                    })()}
                />
            )}
        </>
    );
}
