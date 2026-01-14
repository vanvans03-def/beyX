import RegistrationForm from "@/components/RegistrationForm";
import { getTournaments } from "@/lib/repository"; // Use Postgres

export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const tournaments = await getTournaments();
    // Repository returns Postgres snake_case, but we need to match what we use.
    // Wait, getTournaments returns { id, name, status }.
    // Sheets version returned { TournamentID, Name, Status }.
    // I should check what RegistrationForm expects?
    // RegistrationForm expects "tournamentName".
    // So here I just need to find the correct one.
    const tournament = tournaments.find(t => t.id === id);

    return (
        <div className="min-h-screen relative overflow-hidden bg-background selection:bg-primary/30">
            {/* Background Ambience */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
            </div>

            <main className="relative z-10 max-w-lg mx-auto min-h-screen px-6 py-12 flex flex-col">
                {/* Header */}
                <header className="flex flex-col items-center justify-center space-y-4 mb-8">
                    <div className="text-center space-y-1">
                        <h1 className="text-4xl font-black italic tracking-tighter bg-gradient-to-br from-white via-white to-gray-400 bg-clip-text text-transparent drop-shadow-sm uppercase">
                            {tournament?.name || "TOURNAMENT REGISTER"}
                        </h1>
                        <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
                            {tournament?.name ? "BeyBlade X Tournament" : "BeyBlade X • Season 2026"}
                        </p>
                    </div>
                </header>

                {/* Form */}
                <div className="flex-1 glass-card p-6 md:p-8 rounded-3xl shadow-2xl shadow-black/50 border border-white/5 backdrop-blur-xl">
                    <RegistrationForm
                        tournamentId={id}
                        tournamentName={tournament?.name}
                        tournamentStatus={tournament?.status}
                        tournamentType={tournament?.type}
                        banList={tournament?.ban_list}
                    />
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
