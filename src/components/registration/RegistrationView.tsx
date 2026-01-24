"use client";

import { useRegistration } from "./useRegistration";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle, CheckCircle2, Plus, Trash2, Globe, Eye, XCircle } from "lucide-react";
import { VisualSelector } from "@/components/ui/VisualSelector";
import { BladeSlot } from "./BladeSlot";
import gameData from "@/data/game-data.json";

const allBeys = Object.entries(gameData.points).flatMap(([point, names]) =>
    names.map((name) => ({ name, point: parseInt(point) }))
);
allBeys.sort((a, b) => a.name.localeCompare(b.name));

type RegistrationViewProps = {
    hook: ReturnType<typeof useRegistration>;
    tournamentType: string;
    tournamentStatus?: string;
    challongeUrl?: string;
    banList?: string[];
};

export function RegistrationView({
    hook,
    tournamentType,
    tournamentStatus,
    challongeUrl,
    banList
}: RegistrationViewProps) {
    const {
        profiles,
        activeTab,
        selectingState,
        loading,
        loadingPlayers,
        t,
        lang,
        toggleLang,
        setActiveTab,
        setSelectingState,
        handleSelect,
        addReserveDeck,
        removeReserveDeck,
        addProfile,
        deleteProfile,
        copyComboFromFirst,
        updateProfile,
        handleSubmit,
        validateDeck,
        triggerFetchExistingPlayers, // Use the trigger wrapper
        showPlayerList,
        existingPlayers,
        closePlayerList
    } = hook;

    // Derived
    const activeProfile = profiles[activeTab];
    if (!activeProfile) return null; // Should not happen

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

                {/* Tournament Type Banner */}
                {tournamentType && (
                    <div className="flex justify-center mb-0">
                        <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            tournamentType === 'U10' ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                                tournamentType === 'NoMoreMeta' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                                    "bg-green-500/20 text-green-400 border-green-500/30"
                        )}>
                            TOURNAMENT FORMAT: {tournamentType === 'NoMoreMeta' ? 'NMM' : tournamentType === 'U10' ? 'U10' : 'OPEN'}
                        </span>
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
                            onClick={triggerFetchExistingPlayers}
                            className="bg-secondary hover:bg-secondary/80 text-foreground px-3 rounded-lg border border-input transition-colors disabled:opacity-50 flex items-center justify-center"
                            title="View Registered Players"
                        >
                            {loadingPlayers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>

                    {/* Copy Combo Button */}
                    {activeTab > 0 && activeProfile.status === 'draft' && (!tournamentStatus || tournamentStatus === 'OPEN') && !challongeUrl && tournamentType !== 'Standard' && (
                        <button
                            type="button"
                            onClick={() => copyComboFromFirst(activeTab)}
                            className="text-xs text-primary hover:underline flex items-center gap-1 ml-1"
                        >
                            Make combo same as Player 1
                        </button>
                    )}
                </div>

                {/* Mode Selection - Hide if tournamentType is set (which it always should be in this refactor) */}
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

            {selectingState && (() => {
                const activeP = profiles[selectingState.profileIndex];
                let maxPoint: number | undefined = undefined;

                if (activeP.mode === 'Under10') {
                    // Calculate points used by other slots
                    const otherSlots = currentSelectorDeck.filter((_, idx) => idx !== selectingState.slotIndex);
                    const usedPoints = otherSlots.reduce((sum, name) => {
                        const b = allBeys.find(b => b.name === name);
                        return sum + (b?.point || 0);
                    }, 0);
                    maxPoint = 10 - usedPoints;
                }

                return (
                    <VisualSelector
                        label={selectingState.type === 'main' ? t('reg.deck.main') : t('reg.deck.reserve')}
                        value={
                            selectingState.type === 'main'
                                ? activeP.mainBeys[selectingState.slotIndex]
                                : activeP.reserveDecks[selectingState.deckIndex][selectingState.slotIndex]
                        }
                        onChange={handleSelect}
                        onClose={() => setSelectingState(null)}
                        maxPoint={maxPoint}
                        options={allBeys.map(bey => {
                            const isSelectedInCurrentDeck = currentSelectorDeck.includes(bey.name) && bey.name !== (
                                selectingState.type === 'main'
                                    ? activeP.mainBeys[selectingState.slotIndex]
                                    : activeP.reserveDecks[selectingState.deckIndex][selectingState.slotIndex]
                            );

                            const isBanned = (activeP.mode === 'NoMoreMeta') && (banList || gameData.banList).includes(bey.name);

                            return {
                                ...bey,
                                blocked: isSelectedInCurrentDeck || isBanned
                            };
                        })}
                    />
                );
            })()}

            {/* Player List Modal */}
            {showPlayerList && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-background border border-border rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10 rounded-t-2xl">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Globe className="h-4 w-4 text-primary" />
                                {t('reg.btn.registered_players') || 'Registered Players'} ({existingPlayers.length})
                            </h3>
                            <button
                                onClick={closePlayerList}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <XCircle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {existingPlayers.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>{t('reg.msg.no_players') || 'No players registered yet.'}</p>
                                </div>
                            ) : (
                                existingPlayers.map((name, i) => (
                                    <div key={i} className="px-4 py-3 rounded-xl bg-secondary/30 border border-white/5 flex items-center gap-3">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
                                            {i + 1}
                                        </span>
                                        <span className="font-medium text-foreground">{name}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-white/10 bg-secondary/20 rounded-b-2xl">
                            <button
                                onClick={closePlayerList}
                                className="w-full py-3 bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl transition-all"
                            >
                                {t('reg.btn.close') || 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
