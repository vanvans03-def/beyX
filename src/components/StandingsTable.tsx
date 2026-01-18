
import React from 'react';
import { Trophy, Medal, Award } from 'lucide-react';
import { useTranslation } from "@/hooks/useTranslation";

interface Standing {
    id: number;
    rank: number;
    name: number;
    misc?: string;
}

export default function StandingsTable({ standings }: { standings: Standing[] }) {
    // const { t } = useTranslation();

    const getRankIcon = (rank: number) => {
        const r = rank || 999;
        if (r === 1) return <Trophy className="h-5 w-5 text-yellow-500 fill-yellow-500" />;
        if (r === 2) return <Medal className="h-5 w-5 text-gray-400 fill-gray-400" />; // Silver
        if (r === 3) return <Medal className="h-5 w-5 text-amber-700 fill-amber-700" />; // Bronze
        return <span className="font-bold text-muted-foreground">#{r}</span>;
    };

    const getRowStyle = (rank: number) => {
        if (rank === 1) return "bg-yellow-500/10 border-yellow-500/20";
        if (rank === 2) return "bg-gray-400/10 border-gray-400/20";
        if (rank === 3) return "bg-amber-700/10 border-amber-700/20";
        return "bg-secondary/20 border-white/5";
    };

    return (
        <div className="w-full space-y-2">
            {standings.map((player) => (
                <div
                    key={player.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:bg-white/5 ${getRowStyle(player.rank)}`}
                >
                    <div className="flex items-center justify-center w-8 h-8 shrink-0">
                        {getRankIcon(player.rank)}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="font-bold truncate text-base">{player.name}</div>
                        {player.misc && (
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
