"use client";

import { useEffect, useState } from 'react';
import PublicTournamentView from '@/components/public/PublicTournamentView';

export default function PublicTournamentPageLoader({
    shopName,
    tournamentId,
}: {
    shopName: string;
    tournamentId: string;
}) {
    const [tournament, setTournament] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({ shopName });
        fetch(`/api/public/tournaments/${encodeURIComponent(tournamentId)}?${params.toString()}`, { signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw new Error(response.status === 404 ? 'Tournament not found' : 'Could not load tournament');
                return response.json();
            })
            .then(result => setTournament(result.tournament))
            .catch(fetchError => {
                if (fetchError.name !== 'AbortError') setError(fetchError.message);
            });
        return () => controller.abort();
    }, [shopName, tournamentId]);

    if (error) return <div className="min-h-screen bg-background p-10 text-center text-muted-foreground">{error}</div>;
    if (!tournament) return <div className="min-h-screen bg-background p-10 text-center text-muted-foreground">Loading tournament...</div>;
    return <PublicTournamentView tournament={tournament} registrations={[]} />;
}
