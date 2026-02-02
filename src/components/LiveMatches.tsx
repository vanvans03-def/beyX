'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface Match {
    id: number;
    tournament_id: number;
    player1_id: number | null;
    player2_id: number | null;
    score_csv: string | null;
    state: string;
    winner_id: number | null;
}

interface LiveMatchesProps {
    tournamentId?: number; // Optional filter if we want to show matches for a specific tournament
}

export default function LiveMatches({ tournamentId }: LiveMatchesProps) {
    const supabase = createClient();
    const [matches, setMatches] = useState<Match[]>([]);
    const [status, setStatus] = useState<string>('Connecting...');

    useEffect(() => {
        // Initial fetch (optional, if we want to show current state before updates)
        const fetchMatches = async () => {
            let query = supabase.from('matches').select('*').order('updated_at', { ascending: false }).limit(20);
            if (tournamentId) {
                query = query.eq('tournament_id', tournamentId);
            }
            const { data, error } = await query;
            if (data) setMatches(data);
            if (error) console.error("Error fetching initial matches:", error);
        };

        fetchMatches();

        // Realtime subscription
        const channel = supabase
            .channel('realtime-matches')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' },
                (payload: any) => {
                    console.log('Realtime update received:', payload);
                    const updatedMatch = payload.new as Match;

                    setMatches(prev => {
                        // Check if match already exists in our list
                        const exists = prev.find(m => m.id === updatedMatch.id);
                        if (exists) {
                            return prev.map(m => m.id === updatedMatch.id ? updatedMatch : m);
                        } else {
                            // Add to top if not exists
                            return [updatedMatch, ...prev];
                        }
                    });
                }
            )
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' },
                (payload: any) => {
                    console.log('Realtime insert received:', payload);
                    const newMatch = payload.new as Match;
                    setMatches(prev => [newMatch, ...prev]);
                }
            )
            .subscribe((status) => {
                setStatus(status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tournamentId, supabase]);

    return (
        <div className="p-4 space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Live Matches</h2>
                <span className={`text-xs px-2 py-1 rounded ${status === 'SUBSCRIBED' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {status}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map((match) => (
                    <div key={match.id} className="bg-white/5 p-4 rounded-lg border border-white/10 animate-fade-in">
                        <div className="flex justify-between text-sm text-gray-400 mb-2">
                            <span>Match #{match.id}</span>
                            <span className="capitalize">{match.state}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg font-semibold text-white">
                            <div className={match.winner_id === match.player1_id ? "text-green-400" : ""}>
                                Player 1 (ID: {match.player1_id})
                            </div>
                            <div className="px-4 text-gray-500">
                                {match.score_csv ? match.score_csv.replace(/,/g, " - ") : "VS"}
                            </div>
                            <div className={match.winner_id === match.player2_id ? "text-green-400" : ""}>
                                Player 2 (ID: {match.player2_id})
                            </div>
                        </div>
                    </div>
                ))}
                {matches.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        Waiting for match updates...
                    </div>
                )}
            </div>
        </div>
    );
}
