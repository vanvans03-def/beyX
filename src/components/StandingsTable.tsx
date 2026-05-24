import React, { useState } from 'react';
import { Trophy, Medal, BarChart3 } from 'lucide-react';
import { useTranslation } from "@/hooks/useTranslation";

interface Standing {
    id: number;
    rank: number;
    name: string;
    misc?: string;
}

export default function StandingsTable({ 
    standings, 
    mode, 
    matches = [] 
}: { 
    standings: Standing[], 
    mode?: string, 
    matches?: any[] 
}) {
    const { t } = useTranslation();
    const [showStats, setShowStats] = useState(false);

    // Pre-calculate stats using useMemo for top performance
    const playerStatsMap = React.useMemo(() => {
        const stats: Record<string, { wins: number, losses: number, results: ('W' | 'L')[] }> = {};
        
        standings.forEach(player => {
            const playerMatches = (matches || [])
                .filter(m => {
                    const state = m.state?.toLowerCase();
                    if (state !== 'complete' && state !== 'completed') return false;
                    const p1Name = m.player1?.name?.trim().toLowerCase();
                    const p2Name = m.player2?.name?.trim().toLowerCase();
                    const targetName = player.name.trim().toLowerCase();
                    return p1Name === targetName || p2Name === targetName;
                })
                .sort((a, b) => {
                    const timeA = new Date(a.completed_at || a.updated_at || 0).getTime();
                    const timeB = new Date(b.completed_at || b.updated_at || 0).getTime();
                    return timeA - timeB;
                });

            let wins = 0;
            let losses = 0;
            const results = playerMatches.map(m => {
                const p1Name = m.player1?.name?.trim().toLowerCase();
                const targetName = player.name.trim().toLowerCase();
                const isP1 = p1Name === targetName;
                const isP2 = !isP1;
                const won = (m.winner_id === m.player1_id && isP1) || (m.winner_id === m.player2_id && isP2);
                if (won) wins++;
                else losses++;
                return won ? 'W' as const : 'L' as const;
            });

            stats[player.name.trim().toLowerCase()] = { wins, losses, results };
        });

        return stats;
    }, [standings, matches]);

    const maxMatches = React.useMemo(() => {
        return Math.max(...Object.values(playerStatsMap).map(s => s.results.length), 0);
    }, [playerStatsMap]);

    const getRankIcon = (rank: number) => {
        const r = rank || 999;
        const rankNum = <span className="font-bold text-muted-foreground mr-1">#{r}</span>;

        if (r === 1) return <div className="flex items-center gap-1">{rankNum}<Trophy className="h-5 w-5 text-yellow-500 fill-yellow-500" /></div>;
        if (r === 2) return <div className="flex items-center gap-1">{rankNum}<Medal className="h-5 w-5 text-gray-400 fill-gray-400" /></div>;
        if (r === 3) return <div className="flex items-center gap-1">{rankNum}<Medal className="h-5 w-5 text-amber-700 fill-amber-700" /></div>;
        return rankNum;
    };

    const getRowStyle = (rank: number) => {
        if (rank === 1) return "bg-yellow-500/10 border-yellow-500/20";
        if (rank === 2) return "bg-gray-400/10 border-gray-400/20";
        if (rank === 3) return "bg-amber-700/10 border-amber-700/20";
        return "bg-secondary/20 border-white/5";
    };

    const shouldShowMisc = (misc?: string) => {
        if (!misc) return false;
        if (mode === 'Open' || mode === 'Standard') return false;
        if (misc.trim() === '/  /') return false;
        return true;
    };

    return (
        <div className="w-full space-y-2">
            {standings.length > 0 && maxMatches > 0 && (
                <div className="flex justify-end mb-2">
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            showStats
                                ? 'bg-primary text-black border-primary'
                                : 'bg-secondary/60 text-muted-foreground border-white/5 hover:border-white/10 hover:text-foreground'
                        }`}
                    >
                        <BarChart3 className="h-3.5 w-3.5" />
                        {showStats ? "ซ่อนสถิติ" : "ดูสถิติ (W / L)"}
                    </button>
                </div>
            )}

            {standings.map((player) => {
                const stats = playerStatsMap[player.name.trim().toLowerCase()];
                const totalPlayed = stats ? stats.wins + stats.losses : 0;
                const winRate = totalPlayed > 0 && stats ? Math.round((stats.wins / totalPlayed) * 100) : 0;

                const paddedResults: ('W' | 'L' | '-')[] = stats ? [...stats.results] : [];
                while (paddedResults.length < maxMatches) {
                    paddedResults.push('-');
                }

                return (
                    <div
                        key={player.id}
                        className={`flex flex-col p-4 rounded-lg border transition-all hover:bg-white/5 ${getRowStyle(player.rank)}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center min-w-[3rem] shrink-0">
                                {getRankIcon(player.rank)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="font-bold break-all line-clamp-2 text-base leading-tight">{player.name}</div>
                                {shouldShowMisc(player.misc) && (
                                    <div className="text-xs text-muted-foreground truncate">{player.misc}</div>
                                )}
                            </div>
                        </div>

                        {showStats && stats && totalPlayed > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                                    <span>
                                        แข่งไป {totalPlayed} แมทช์ &bull; ชนะ <span className="text-green-400 font-bold">{stats.wins}</span> แพ้ <span className="text-red-400 font-bold">{stats.losses}</span>
                                    </span>
                                    <span className="font-semibold text-foreground/80">Win Rate: {winRate}%</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {paddedResults.map((res, i) => (
                                        <span
                                            key={i}
                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm select-none border transition-all ${
                                                res === 'W'
                                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                                    : res === 'L'
                                                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                                    : 'bg-white/5 text-muted-foreground/30 border-white/5'
                                            }`}
                                        >
                                            {res}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
            {standings.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">
                    {t('standings.empty')}
                </div>
            )}
        </div>
    );
}
