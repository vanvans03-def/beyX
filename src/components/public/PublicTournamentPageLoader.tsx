"use client";

import { useEffect, useState } from 'react';
import PublicTournamentView from '@/components/public/PublicTournamentView';

export default function PublicTournamentPageLoader({ tournamentId }: { tournamentId: string }) {
    const [tournament, setTournament] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/public/tournaments/${encodeURIComponent(tournamentId)}`, { signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw new Error(response.status === 404 ? 'Tournament not found' : 'Could not load tournament');
                return response.json();
            })
            .then(result => setTournament(result.tournament))
            .catch(fetchError => {
                if (fetchError.name !== 'AbortError') setError(fetchError.message);
            });
        return () => controller.abort();
    }, [tournamentId]);

    if (error) return <div className="min-h-screen bg-background p-10 text-center text-muted-foreground">{error}</div>;
    if (!tournament) return <div className="min-h-screen bg-background p-10 text-center text-muted-foreground">Loading tournament...</div>;
    return <PublicTournamentView tournament={tournament} registrations={[]} />;
}
