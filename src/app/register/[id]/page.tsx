import TournamentViewerButton from "@/components/TournamentViewerButton";
import RegistrationForm from "@/components/RegistrationForm";
import { getTournament } from "@/lib/repository";
import { Metadata, ResolvingMetadata } from "next";
import StandingsTable from "@/components/StandingsTable";
import { getTournamentStandings } from "@/lib/challonge";

export const dynamic = 'force-dynamic';

type Props = {
    params: Promise<{ id: string }>
}

export default async function RegisterPage({ params }: Props) {
    const { id } = await params;
    const tournament = await getTournament(id);

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
                <header className="flex flex-col items-center justify-center space-y-4 mb-8">
                    <div className="text-center space-y-1">
                        <h1 className="text-4xl font-black italic text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] uppercase py-4 leading-loose">
                            {tournament?.name || "TOURNAMENT REGISTER"}
                        </h1>
                        <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
                            {tournament?.name ? "BeyBlade X Tournament" : "BeyBlade X • Season 2026"}
                        </p>
                    </div>
                    {tournament?.challonge_url && (
                        <div className="pt-2">
                            <TournamentViewerButton url={tournament.challonge_url} tournamentId={id} />
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
                            {tournament.challonge_url && (
                                <StandingsTable standings={await getTournamentStandings(tournament.challonge_url.split('/').pop()!)} />
                            )}
                        </div>
                    ) : (
                        <RegistrationForm
                            tournamentId={id}
                            tournamentName={tournament?.name}
                            tournamentStatus={tournament?.status}
                            tournamentType={tournament?.type}
                            banList={tournament?.ban_list}
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

