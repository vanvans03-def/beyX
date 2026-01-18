"use client";

import { useState, useEffect } from "react";
import { Trophy, XCircle, ListOrdered } from "lucide-react";
import TournamentBracket from "@/components/TournamentBracket";
import StandingsTable from "@/components/StandingsTable";

import { useTranslation } from "@/hooks/useTranslation";

export default function TournamentViewerButton({ url, tournamentId }: { url: string, tournamentId?: string }) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'bracket' | 'standings'>('bracket');
    const [standings, setStandings] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && activeTab === 'standings' && tournamentId && standings.length === 0) {
            fetch(`/api/admin/tournaments/${tournamentId}/standings`)
                .then(res => res.json())
                .then(json => {
                    if (json.success) setStandings(json.data);
                })
                .catch(console.error);
        }
    }, [isOpen, activeTab, tournamentId, standings.length]);

    if (!url) return null;

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-full font-bold shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform animate-pulse"
            >
                <Trophy className="h-4 w-4" />
                <span>{t('reg.btn.view_bracket')}</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="relative w-full max-w-5xl h-[100dvh] sm:h-[90vh] bg-background border border-white/10 sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-secondary/20 shrink-0">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setActiveTab('bracket')}
                                    className={`flex items-center gap-2 font-bold px-3 py-1 rounded-lg transition-colors ${activeTab === 'bracket' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white'}`}
                                >
                                    <Trophy className="h-5 w-5" />
                                    Bracket
                                </button>
                                {tournamentId && (
                                    <button
                                        onClick={() => setActiveTab('standings')}
                                        className={`flex items-center gap-2 font-bold px-3 py-1 rounded-lg transition-colors ${activeTab === 'standings' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white'}`}
                                    >
                                        <ListOrdered className="h-5 w-5" />
                                        Standings
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <XCircle className="h-6 w-6 text-muted-foreground hover:text-white" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden bg-black/50 flex flex-col relative">
                            {activeTab === 'bracket' ? (
                                <TournamentBracket challongeUrl={url} variant="minimal" />
                            ) : (
                                <div className="p-6 md:p-8 overflow-y-auto h-full">
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <Trophy className="h-6 w-6 text-yellow-500" />
                                        Official Standings
                                    </h3>
                                    <StandingsTable standings={standings} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
