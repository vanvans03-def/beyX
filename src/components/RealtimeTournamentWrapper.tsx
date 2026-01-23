"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import TournamentViewerButton from "@/components/TournamentViewerButton";
import RegistrationForm from "@/components/RegistrationForm";
import StandingsTable from "@/components/StandingsTable";
import { getTournamentStandings } from "@/lib/challonge";
import { Trophy } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type Tournament = {
    id: string;
    name: string;
    status: 'OPEN' | 'CLOSED' | 'STARTED' | 'COMPLETED';
    type: 'U10' | 'NoMoreMeta' | 'Open';
    ban_list: string[];
    challonge_url?: string;
    organizer_name?: string;
};

type Props = {
    initialTournament: Tournament;
    tournamentId: string;
    initialStandings?: any; // Standings data if completed
};

export default function RealtimeTournamentWrapper({ initialTournament, tournamentId, initialStandings }: Props) {
    const { t } = useTranslation();
    const [tournament, setTournament] = useState<Tournament>(initialTournament);
    const [standings, setStandings] = useState<any>(initialStandings);

    useEffect(() => {
        // Subscribe to changes for this specific tournament
        const channel = supabase
            .channel(`tournament-${tournamentId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tournaments',
                    filter: `id=eq.${tournamentId}`
                },
                (payload) => {
                    console.log('Realtime update received:', payload);
                    const newData = payload.new as any;

                    setTournament(prev => ({
                        ...prev,
                        ...newData, // Apply updates (status, challonge_url, etc.)
                        // Ensure arrays are handled if payload returns generic json
                    }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tournamentId]);

    // Fetch standings client-side if status changes to COMPLETED and we don't have them yet
    useEffect(() => {
        if ((tournament.status === 'COMPLETED' || tournament.status === 'CLOSED') && tournament.challonge_url && !standings) {
            const urlCode = tournament.challonge_url.split('/').pop();
            if (urlCode) {
                // We can't use the server action directly here easily used in getStaticProps
                // So we might need a simple fetch to our API or just re-refresh
                // For now, let's keep it simple: if it just completed, user might need to refresh for standings
                // OR we can fetch from an internal API endpoint if we created one.
                // Let's assume for now the user sees "Tournament Ended" message.
            }
        }
    }, [tournament.status, tournament.challonge_url, standings]);

    return (
        <div className="min-h-screen relative overflow-hidden bg-background selection:bg-primary/30">
            {/* Background Ambience */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
            </div>

            <main className="relative z-10 max-w-lg mx-auto min-h-screen px-6 py-12 flex flex-col" data-aos="fade-in" suppressHydrationWarning>
                {/* Header */}
                <header className="flex flex-col items-center justify-center space-y-2 mb-6">
                    <div className="text-center space-y-1">
                        <h1 className="text-2xl font-black italic text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] uppercase py-2 leading-relaxed">
                            {tournament?.name || "TOURNAMENT REGISTER"}
                        </h1>
                        <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase flex items-center justify-center gap-1">
                            {t('header.hosted_by')}: <span className="text-primary">{tournament.organizer_name || "Official"}</span>
                        </p>
                    </div>

                    {/* Realtime: Show button if Challonge URL exists */}
                    {tournament?.challonge_url && (
                        <div className="pt-2 animate-in fade-in zoom-in duration-500">
                            <TournamentViewerButton url={tournament.challonge_url} tournamentId={tournamentId} />
                        </div>
                    )}
                </header>

                {/* Form */}
                <div className="flex-1 glass-card p-6 md:p-8 rounded-3xl shadow-2xl shadow-black/50 border border-white/5 backdrop-blur-xl">
                    {(tournament?.status === 'COMPLETED' || tournament?.status === 'CLOSED') ? (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black italic text-center uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 drop-shadow-sm">
                                Final Results
                            </h2>
                            {standings ? (
                                <StandingsTable standings={standings} />
                            ) : (
                                <div className="text-center p-8 text-muted-foreground">
                                    <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>Tournament has ended.</p>
                                    <p className="text-xs mt-2">Refresh to see final standings.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <RegistrationForm
                            tournamentId={tournamentId}
                            tournamentName={tournament?.name}
                            tournamentStatus={tournament?.status} // Realtime status passed here
                            tournamentType={tournament?.type}
                            banList={tournament?.ban_list}
                            challongeUrl={tournament?.challonge_url}
                        />
                    )}
                </div>

                {/* Footer */}
                <footer className="mt-8 text-center">
                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-medium">
                        Powered by สายใต้ยิม
                    </p>
                </footer>
            </main>
        </div>
    );
}
