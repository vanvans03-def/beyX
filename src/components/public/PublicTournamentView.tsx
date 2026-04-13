"use client";

import { Users, Trophy, Clock, ChevronLeft, ShieldCheck, Globe } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect } from "react";
import InternalBracket from "@/components/InternalBracket";
import { supabase } from "@/lib/supabase";

type PublicTournamentViewProps = {
    tournament: any;
    registrations: any[];
};

export default function PublicTournamentView({ tournament, registrations }: PublicTournamentViewProps) {
    const { t, lang, toggleLang } = useTranslation();
    const [activeTab, setActiveTab] = useState<'players' | 'bracket'>('players');
    const [internalMatches, setInternalMatches] = useState<any[]>([]);

    useEffect(() => {
        if (tournament.provider === 'INTERNAL' && activeTab === 'bracket') {
            const fetchMatches = async () => {
                const { data } = await supabase
                    .from('internal_matches')
                    .select('*, player1:player1_id(player_name), player2:player2_id(player_name)')
                    .eq('tournament_id', tournament.id);
                if (data) setInternalMatches(data);
            };
            fetchMatches();

            // Real-time subscription
            const channel = supabase.channel(`public-matches-${tournament.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_matches', filter: `tournament_id=eq.${tournament.id}` }, () => {
                    fetchMatches();
                })
                .subscribe();
            
            return () => { supabase.removeChannel(channel); };
        }
    }, [tournament.id, tournament.provider, activeTab]);

    const getStatusText = (status: string) => {
        switch (status) {
            case 'OPEN': return t('public.status.open');
            case 'STARTED': return t('public.status.started');
            case 'CLOSED': return t('public.status.closed');
            case 'COMPLETED': return t('public.status.completed');
            default: return status;
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            {/* Background Ambience */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
            </div>

            {/* Header / Hero */}
            <div className="relative border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white">
                        <ChevronLeft className="h-6 w-6" />
                    </Link>
                    <div className="text-center flex-1">
                        <h1 className="font-black italic text-xl tracking-tighter uppercase leading-tight text-white">
                            {tournament.name}
                        </h1>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5 text-primary/80" />
                                {tournament.organizer_name}
                            </p>
                            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">
                                {tournament.provider}
                            </span>
                        </div>
                    </div>
                    <button 
                        onClick={toggleLang}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-all active:scale-95"
                    >
                        <Globe className="h-3 w-3" />
                        {lang}
                    </button>
                </div>

                {/* Tabs */}
                <div className="max-w-4xl mx-auto px-6 flex items-center gap-8 border-t border-white/5">
                    <button 
                        onClick={() => setActiveTab('players')}
                        className={cn(
                            "py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                            activeTab === 'players' ? "text-primary" : "text-muted-foreground hover:text-white"
                        )}
                    >
                        {t('public.players')}
                        {activeTab === 'players' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />}
                    </button>
                    {(tournament.status === 'STARTED' || tournament.status === 'COMPLETED') && tournament.provider === 'INTERNAL' && (
                        <button 
                            onClick={() => setActiveTab('bracket')}
                            className={cn(
                                "py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                                activeTab === 'bracket' ? "text-primary" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            Bracket
                            {activeTab === 'bracket' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />}
                        </button>
                    )}
                </div>
            </div>

            <main className="relative z-10 max-w-4xl mx-auto px-6 pt-8 space-y-8">
                {activeTab === 'players' ? (
                    <>
                        {/* Stats / Status */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/[0.02] border border-white/10 p-5 rounded-3xl backdrop-blur-md">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="p-1.5 bg-primary/20 rounded-lg">
                                        <Users className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">{t('public.players')}</span>
                                </div>
                                <p className="text-3xl font-black italic text-white tracking-tighter">
                                    {registrations.length}
                                </p>
                            </div>
                            <div className={cn(
                                "border p-5 rounded-3xl flex flex-col justify-center backdrop-blur-md transition-all relative overflow-hidden",
                                tournament.status === 'OPEN' ? "bg-emerald-500/5 border-emerald-500/10" :
                                    tournament.status === 'STARTED' ? "bg-primary/10 border-primary/20 ring-1 ring-primary/20" :
                                        "bg-white/[0.02] border-white/10"
                            )}>
                                {tournament.status === 'STARTED' && (
                                    <div className="absolute top-0 right-0 p-1">
                                        <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
                                    </div>
                                )}
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="p-1.5 bg-white/10 rounded-lg">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">{t('public.status')}</span>
                                </div>
                                <p className={cn(
                                    "text-xs font-black uppercase italic tracking-widest",
                                    tournament.status === 'OPEN' ? "text-emerald-400" :
                                        tournament.status === 'STARTED' ? "text-primary brightness-125 drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" :
                                            "text-muted-foreground"
                                )}>
                                    {getStatusText(tournament.status)}
                                </p>
                            </div>
                        </div>

                        {/* Player List */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h2 className="font-black text-sm uppercase italic tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2">
                                    <div className="h-1 w-8 bg-primary/50" />
                                    {t('public.registered_players')}
                                </h2>
                            </div>

                            <div className="bg-white/[0.01] border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/20">
                                {registrations.length === 0 ? (
                                    <div className="py-24 text-center px-10">
                                        <div className="p-4 bg-white/5 rounded-full w-fit mx-auto mb-4">
                                            <Trophy className="h-8 w-8 text-muted-foreground/20" />
                                        </div>
                                        <h3 className="text-white font-bold text-lg mb-1">{t('public.no_registrations')}</h3>
                                        <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">{t('public.be_first')}</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-white/[0.05]">
                                        {registrations.map((player, idx) => (
                                            <div key={player.id} className="p-5 flex items-center justify-between group hover:bg-white/[0.03] transition-all cursor-default">
                                                <div className="flex items-center gap-5">
                                                    <div className="flex items-center justify-center w-8 text-center">
                                                        <span className="text-sm font-black italic tracking-tighter text-muted-foreground/30 group-hover:text-primary/50 transition-colors">
                                                            {(idx + 1).toString().padStart(2, '0')}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-lg text-white/90 group-hover:text-white transition-colors tracking-tight">
                                                            {player.player_name}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-0.5">
                                                            <span className="px-2 py-0.5 bg-secondary text-[9px] font-black uppercase italic tracking-widest rounded-md text-muted-foreground/80">
                                                                {player.mode}
                                                            </span>
                                                            <span className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-widest flex items-center gap-1">
                                                                <Clock className="h-2.5 w-2.5" />
                                                                {new Date(player.timestamp).toLocaleTimeString(lang === 'TH' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-center p-3">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-primary/40 shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                             <h2 className="font-black text-sm uppercase italic tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2">
                                <div className="h-1 w-8 bg-primary/50" />
                                Tournament Bracket
                            </h2>
                        </div>
                        <InternalBracket matches={internalMatches} />
                    </div>
                )}

                {/* Footer Info */}
                <div className="text-center pt-10 pb-4">
                    <div className="h-px w-10 bg-white/10 mx-auto mb-6" />
                    <p className="text-[10px] uppercase font-black italic tracking-[0.4em] text-muted-foreground/30">
                        {t('public.powered_by')}
                    </p>
                </div>
            </main>
        </div>
    );
}
