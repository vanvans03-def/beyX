import React from 'react';
import { Trophy, Medal } from 'lucide-react';

interface Standing {
    id: number;
    rank: number;
    name: string;
    misc?: string;
}

export default function StandingsTable({ standings, mode }: { standings: Standing[], mode?: string }) {
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
        // If mode is Open/Standard, usually misc (combo) is empty or just placeholders. 
        // We can double check if misc contains only placeholders like "/ /"
        if (mode === 'Open' || mode === 'Standard') return false;
        if (misc.trim() === '/  /') return false; // Default placeholder check just in case
        return true;
    };

    return (
        <div className="w-full space-y-2">
            {standings.map((player) => (
                <div
                    key={player.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:bg-white/5 ${getRowStyle(player.rank)}`}
                >
                    <div className="flex items-center justify-center min-w-[3rem] shrink-0">
                        {getRankIcon(player.rank)}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="font-bold break-all line-clamp-2 text-base leading-tight">{player.name}</div>
                        {shouldShowMisc(player.misc) && (
                            <div className="text-xs text-muted-foreground truncate">{player.misc}</div>
                        )}
                    </div>

                    <div className="text-sm font-bold opacity-50">
                        {/* Could put score or w/l here if available */}
                    </div>
                </div>
            ))}
            {standings.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">
                    No standings data available.
                </div>
            )}
        </div>
    );
}
