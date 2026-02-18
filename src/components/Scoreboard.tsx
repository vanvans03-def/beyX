"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, RotateCcw, Minus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

type Player = {
    id: number;
    name: string;
    score: number;
    color: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    shadowClass: string;
};

type HistoryState = {
    players: Player[];
};

interface ScoreboardProps {
    onBack?: () => void;
}

export default function Scoreboard({ onBack }: ScoreboardProps) {
    const [playerCount, setPlayerCount] = useState<2 | 3>(2);
    const [players, setPlayers] = useState<Player[]>([
        {
            id: 1,
            name: "RED",
            score: 0,
            color: "red",
            bgClass: "from-red-600 to-red-800",
            textClass: "text-red-500",
            borderClass: "border-red-500",
            shadowClass: "shadow-red-500/20"
        },
        {
            id: 2,
            name: "BLUE",
            score: 0,
            color: "blue",
            bgClass: "from-blue-600 to-blue-800",
            textClass: "text-blue-500",
            borderClass: "border-blue-500",
            shadowClass: "shadow-blue-500/20"
        },
        {
            id: 3,
            name: "GREEN",
            score: 0,
            color: "green",
            bgClass: "from-green-600 to-green-800",
            textClass: "text-green-500",
            borderClass: "border-green-500",
            shadowClass: "shadow-green-500/20"
        },
    ]);

    // History for undoing entire actions if needed, though simple -1 is provided
    const [history, setHistory] = useState<HistoryState[]>([]);

    // Animation State
    const [animatingPlayerId, setAnimatingPlayerId] = useState<number | null>(null);
    const [animationText, setAnimationText] = useState<string>("");

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        variant: "default" | "destructive";
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: "",
        description: "",
        variant: "default",
        onConfirm: () => { },
    });

    const activePlayers = players.slice(0, playerCount);

    const addToHistory = () => {
        setHistory((prev) => [...prev, { players: JSON.parse(JSON.stringify(players)) }]);
        if (history.length > 20) {
            setHistory(prev => prev.slice(1));
        }
    };

    const handleScore = (playerId: number, points: number, type: string) => {
        addToHistory();
        setPlayers(prev => prev.map(p => {
            if (p.id === playerId) {
                return { ...p, score: p.score + points };
            }
            return p;
        }));

        // Trigger Animation
        triggerAnimation(playerId, type);
    };

    const triggerAnimation = (playerId: number, text: string) => {
        setAnimationText(text);
        setAnimatingPlayerId(playerId);

        // Reset animation after delay
        setTimeout(() => {
            setAnimatingPlayerId(null);
            setAnimationText("");
        }, 2000);
    };

    const decrementScore = (playerId: number) => {
        const player = players.find(p => p.id === playerId);
        if (!player || player.score === 0) return;

        setModalConfig({
            isOpen: true,
            title: "Remove Point?",
            description: `Are you sure you want to remove 1 point from ${player.name}?`,
            variant: "destructive",
            onConfirm: () => {
                addToHistory();
                setPlayers(prev => prev.map(p => {
                    if (p.id === playerId) {
                        return { ...p, score: Math.max(0, p.score - 1) };
                    }
                    return p;
                }));
                setModalConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const resetGame = () => {
        setModalConfig({
            isOpen: true,
            title: "Reset Match?",
            description: "Current scores will be lost. This action cannot be undone.",
            variant: "destructive",
            onConfirm: () => {
                addToHistory();
                setPlayers(prev => prev.map(p => ({ ...p, score: 0 })));
                setModalConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    return (
        <div className="fixed inset-0 h-[100dvh] w-screen bg-neutral-950 text-white flex flex-col overflow-hidden font-sans select-none z-50 touching-none">
            {/* Top Bar - Overlay in Landscape to save space */}
            <header className="flex-none h-14 landscape:h-10 landscape:absolute landscape:top-0 landscape:left-0 landscape:w-full landscape:bg-gradient-to-b landscape:from-black/80 landscape:to-transparent landscape:border-b-0 border-b border-white/10 flex items-center justify-between px-4 md:px-6 bg-neutral-900/50 backdrop-blur-md z-50">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors bg-black/20 landscape:bg-black/40 px-3 py-1.5 rounded-full"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="font-bold text-xs">Back</span>
                </button>

                <div className="flex items-center gap-4">
                    {/* Player Count Toggle - HIDDEN as requested (Only 2P) */}
                    {/* <div className="hidden md:flex bg-black/40 p-1 rounded-lg items-center border border-white/5">...</div> */}

                    <button
                        onClick={resetGame}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-all border border-red-500/20 font-bold uppercase text-[10px] tracking-wider landscape:bg-black/40"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col md:flex-row landscape:flex-row relative min-h-0 landscape:pt-0">
                {activePlayers.map((player, index) => {
                    const isTwoPlayer = activePlayers.length === 2;
                    const isPlayerOne = index === 0;

                    return (
                        <div
                            key={player.id}
                            className={cn(
                                "flex-1 flex flex-col relative transition-all duration-500 ease-in-out min-h-0",
                                // Border logic
                                activePlayers.length === 3
                                    ? "md:border-r landscape:border-r last:border-r-0 border-white/5"
                                    : "md:first:border-r landscape:first:border-r border-white/5",
                                // 2P Landscape Layout: P1 Row-Reverse (Controls Left), P2 Row (Controls Right)
                                isTwoPlayer && "landscape:flex-row",
                                isTwoPlayer && isPlayerOne && "landscape:flex-row-reverse"
                            )}
                        >
                            {/* Background Tint */}
                            <div className={cn("absolute inset-0 opacity-5 bg-gradient-to-b pointer-events-none", player.bgClass)} />

                            {/* Score Area (Top/Center) */}
                            <div className="flex-1 flex flex-col items-center justify-center relative p-0 min-h-0 z-0 w-full overflow-hidden">
                                <h2 className={cn("text-2xl landscape:text-xl md:text-3xl font-black italic tracking-widest uppercase mb-4 landscape:mb-0 opacity-80 landscape:opacity-50 absolute top-8 landscape:top-4 z-10", player.textClass)}>
                                    {player.name}
                                </h2>

                                <div className="relative group cursor-default flex-1 flex items-center justify-center w-full h-full">
                                    {/* Huge Score Number */}
                                    <div className={cn(
                                        "text-[150px] landscape:text-[250px] md:text-[400px] leading-none font-black text-white drop-shadow-2xl tabular-nums transition-transform duration-150 z-[1] relative select-none flex items-center justify-center h-full w-full",
                                        animatingPlayerId === player.id ? "scale-105" : "scale-100"
                                    )}>
                                        {player.score}
                                    </div>
                                </div>
                            </div>

                            {/* Animation Overlay - Moved to be a sibling of the score/controls area but fixed relative to screen or container with high Z */}
                            {animatingPlayerId === player.id && (
                                <div className="absolute inset-0 flex items-center justify-center z-[100] pointer-events-none overflow-hidden">
                                    <div className="bg-black/90 backdrop-blur-xl border border-white/20 px-6 py-4 landscape:px-8 landscape:py-4 md:px-16 md:py-10 rounded-[1.5rem] md:rounded-[3rem] transform rotate-[-3deg] shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in zoom-in-50 fade-in duration-200 slide-in-from-bottom-10 ease-out">
                                        <span className={cn(
                                            "text-3xl landscape:text-4xl md:text-8xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400 drop-shadow-sm whitespace-nowrap",
                                            player.textClass
                                        )}>
                                            {animationText}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Controls Area (Bottom/Side) */}
                            <div className={cn(
                                "flex-none p-4 landscape:p-1 md:p-6 bg-black/20 backdrop-blur-sm z-20",
                                // Border separation depends on layout
                                "border-t landscape:border-t-0 border-white/5",
                                isTwoPlayer && "landscape:w-24 md:landscape:w-32 lg:landscape:w-40 landscape:border-l border-white/5",
                                isTwoPlayer && isPlayerOne && "landscape:border-l-0 landscape:border-r"
                            )}>
                                <div className={cn(
                                    "grid gap-2 mx-auto h-full content-center",
                                    // Grid columns: 2 cols for mobile portrait, 1 col for side controls in landscape
                                    isTwoPlayer ? "grid-cols-2 landscape:grid-cols-1" : "grid-cols-2"
                                )}>
                                    <button
                                        onClick={() => handleScore(player.id, 1, "Spin Finish")}
                                        disabled={animatingPlayerId !== null}
                                        className="bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 text-white p-2 landscape:p-2 md:p-3 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 group relative overflow-hidden"
                                    >
                                        <span className="text-lg landscape:text-xl md:text-2xl font-bold group-hover:text-primary transition-colors">+1</span>
                                        <span className="text-[8px] md:text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-center leading-tight">Spin</span>
                                    </button>

                                    <button
                                        onClick={() => handleScore(player.id, 2, "Burst Finish")}
                                        disabled={animatingPlayerId !== null}
                                        className={cn(
                                            "relative overflow-hidden bg-gradient-to-br p-2 landscape:p-2 md:p-3 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-lg group border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed",
                                            player.bgClass
                                        )}
                                    >
                                        <span className="text-lg landscape:text-xl md:text-2xl font-bold text-white drop-shadow-md group-hover:scale-110 transition-transform">+2</span>
                                        <span className="text-[8px] md:text-[10px] font-bold text-white/90 uppercase tracking-wider text-center leading-tight">Burst</span>
                                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>

                                    <button
                                        onClick={() => handleScore(player.id, 2, "Over Finish")}
                                        disabled={animatingPlayerId !== null}
                                        className="bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 text-white p-2 landscape:p-2 md:p-3 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 group relative overflow-hidden"
                                    >
                                        <span className="text-lg landscape:text-xl md:text-2xl font-bold group-hover:text-yellow-400 transition-colors">+2</span>
                                        <span className="text-[8px] md:text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-center leading-tight">Over</span>
                                    </button>

                                    <button
                                        onClick={() => handleScore(player.id, 3, "Xtreme Finish")}
                                        disabled={animatingPlayerId !== null}
                                        className="bg-neutral-900 border border-white/10 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 landscape:p-2 md:p-3 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 group shadow-inner relative overflow-hidden"
                                    >
                                        <span className="text-lg landscape:text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 group-hover:scale-110 transition-transform">+3</span>
                                        <span className="text-[8px] md:text-[10px] font-black text-muted-foreground group-hover:text-white uppercase tracking-wider text-center leading-tight">Xtreme</span>
                                    </button>

                                    {/* Decrement Button - Moved Here */}
                                    <button
                                        onClick={() => decrementScore(player.id)}
                                        disabled={animatingPlayerId !== null}
                                        className="col-span-2 landscape:col-span-1 bg-white/5 hover:bg-red-500/20 active:bg-red-500/30 border border-white/5 hover:border-red-500/30 text-muted-foreground hover:text-red-500 p-2 landscape:p-2 md:p-3 rounded-lg flex flex-row landscape:flex-col items-center justify-center gap-2 transition-all active:scale-95 group mt-2 landscape:mt-4"
                                    >
                                        <Minus className="h-4 w-4" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Remove</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </main>

            <Modal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                title={modalConfig.title}
                description={modalConfig.description}
                type="confirm"
                variant={modalConfig.variant}
                onConfirm={modalConfig.onConfirm}
                confirmText="Confirm"
                cancelText="Cancel"
            />
        </div>
    );
}
