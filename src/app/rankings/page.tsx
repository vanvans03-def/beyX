'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, ArrowLeft, ExternalLink, Globe, LoaderCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

type Ranking = { rank: number; playerId: string; name: string; points?: number; championships?: number; topFour?: number; wins?: number; matches?: number; winRate?: number };
type HistoryGroup = { name: string; results: { tournament_id: string; tournament_name: string; organizer_name: string; tournament_url: string | null; tournament_external: boolean; placement: number; points: number; tournament_completed_at: string }[] };
type RankingScope = 'month' | 'year' | 'winrate';

function RankingsLoading({ label }: { label: string }) {
    return (
        <div aria-label="Loading rankings" aria-live="polite" className="divide-y divide-white/5">
            <div className="flex items-center justify-center gap-2 border-b border-white/5 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                <span className="animate-pulse">{label}</span>
            </div>
            {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex animate-pulse items-center gap-3 p-3 sm:gap-4 sm:p-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-white/10" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-4 rounded-full bg-white/10" style={{ width: `${58 + (index % 3) * 9}%` }} />
                        <div className="h-3 w-40 max-w-[75%] rounded-full bg-white/5" />
                    </div>
                    <div className="h-6 w-14 shrink-0 rounded-full bg-primary/10" />
                </div>
            ))}
        </div>
    );
}

export default function RankingsPage() {
    const { t, lang, toggleLang } = useTranslation();
    const [scope, setScope] = useState<RankingScope>('month');
    const [rankings, setRankings] = useState<Ranking[]>([]);
    const [loading, setLoading] = useState(true);
    const now = new Date();
    const defaultPeriod = scope === 'month'
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        : scope === 'year' ? String(now.getFullYear()) : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [period, setPeriod] = useState(defaultPeriod);
    const [history, setHistory] = useState<{ player: string; groups: HistoryGroup[] } | null>(null);
    const [historyPlayerId, setHistoryPlayerId] = useState<string | null>(null);
    const [historyLoadingPlayerId, setHistoryLoadingPlayerId] = useState<string | null>(null);
    const monthOptions = Array.from({ length: now.getMonth() + 1 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return { value, label: date.toLocaleDateString(lang === 'TH' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' }) };
    });
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYear = String(now.getFullYear());

    const beginRankingChange = () => {
        setLoading(true);
        setRankings([]);
        setHistory(null);
        setHistoryPlayerId(null);
        setHistoryLoadingPlayerId(null);
    };

    const changeScope = (nextScope: RankingScope) => {
        if (nextScope === scope) return;
        beginRankingChange();
        setScope(nextScope);
        setPeriod(nextScope === 'year' ? currentYear : currentMonth);
    };

    const changePeriod = (nextPeriod: string) => {
        if (nextPeriod === period) return;
        beginRankingChange();
        setPeriod(nextPeriod);
    };

    const rankSymbol = (rank: number) => {
        if (rank <= 4) {
            const badge = scope === 'winrate' ? `w${rank}` : `${rank}${scope === 'month' ? 'M' : 'Y'}`;
            const label = scope === 'winrate' ? 'Win Rate' : scope === 'month' ? 'Monthly' : 'Yearly';
            return <img src={`/images/badge/${badge}-Photoroom.webp`} alt={`${label} Top ${rank}`} width={40} height={40} className="mx-auto h-10 w-10 object-contain" />;
        }
        return `#${rank}`;
    };

    const showHistory = async (playerId: string) => {
        if (historyPlayerId === playerId) {
            setHistory(null);
            setHistoryPlayerId(null);
            return;
        }
        setHistory(null);
        setHistoryPlayerId(null);
        setHistoryLoadingPlayerId(playerId);
        try {
            const response = await fetch(`/api/public/players/${playerId}/history?scope=${scope}&period=${period}`);
            const data = await response.json();
            if (response.ok) {
                setHistory(data);
                setHistoryPlayerId(playerId);
            }
        } finally {
            setHistoryLoadingPlayerId(null);
        }
    };

    useEffect(() => {
        const periodIsValid = scope === 'year' ? /^\d{4}$/.test(period) : /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
        if (!periodIsValid) {
            setRankings([]);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setHistory(null);
        setHistoryPlayerId(null);
        fetch(`/api/public/rankings?scope=${scope}&period=${period}`, { signal: controller.signal })
            .then(async response => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Unable to load rankings');
                return data;
            })
            .then(data => setRankings(Array.isArray(data.rankings) ? data.rankings : []))
            .catch(error => {
                if (error instanceof Error && error.name !== 'AbortError') setRankings([]);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [scope, period]);

    return (
        <main className="min-h-screen bg-[#050505] p-3 text-white sm:p-6">
            <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between gap-3"><Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white"><ArrowLeft className="h-4 w-4" /> {t('rankings.back')}</Link><button onClick={toggleLang} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/10"><Globe className="h-3.5 w-3.5" /> {lang === 'TH' ? 'EN' : 'TH'}</button></div>
                <header className="text-center space-y-2">
                    <Trophy className="mx-auto h-10 w-10 text-yellow-400" />
                    <h1 className="text-2xl font-black sm:text-3xl">{t('rankings.title')}</h1>
                    <p className="text-sm text-muted-foreground">{scope === 'winrate' ? t('rankings.winrate_rule') : t('rankings.rule')}</p>
                </header>
                <div className="flex flex-wrap justify-center gap-2">
                    <button onClick={() => changeScope('month')} className={`rounded-lg px-4 py-2 font-bold ${scope === 'month' ? 'bg-primary text-black' : 'bg-white/10'}`}>{t('rankings.monthly')}</button>
                    <button onClick={() => changeScope('year')} className={`rounded-lg px-4 py-2 font-bold ${scope === 'year' ? 'bg-primary text-black' : 'bg-white/10'}`}>{t('rankings.yearly')}</button>
                    <button onClick={() => changeScope('winrate')} className={`rounded-lg px-4 py-2 font-bold ${scope === 'winrate' ? 'bg-primary text-black' : 'bg-white/10'}`}>{t('rankings.winrate')}</button>
                    {scope === 'month' || scope === 'winrate' ? <select value={period} onChange={e => changePeriod(e.target.value)} aria-label="เลือกเดือน" className="max-w-44 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2">{monthOptions.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}</select> : <input type="number" min="2020" max="2100" value={period} onChange={e => changePeriod(e.target.value)} aria-label="เลือกปี" className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2" />}
                </div>
                <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    {loading ? <RankingsLoading label={t('rankings.loading')} /> : rankings.length === 0 ? <p className="p-10 text-center text-muted-foreground">{t('rankings.empty')}</p> : rankings.map(player => (
                        <div key={player.playerId} className="border-b border-white/5 last:border-0">
                        <button onClick={() => scope !== 'winrate' && void showHistory(player.playerId)} className={`flex w-full items-center gap-2 p-3 text-left transition-colors sm:gap-4 sm:p-4 ${scope === 'winrate' ? 'cursor-default' : 'hover:bg-white/5'}`}>
                            <div className="w-8 shrink-0 text-center font-black text-lg text-primary sm:w-9 sm:text-xl">{rankSymbol(player.rank)}</div>
                            <div className="min-w-0 flex-1 font-bold"><div className="truncate">{player.name}</div><div className="text-xs font-normal text-muted-foreground">{scope === 'winrate' ? `${t('rankings.matches')} ${player.matches ?? 0} • ${t('rankings.wins')} ${player.wins ?? 0}` : <>{t('rankings.championships')} {player.championships ?? 0} • {t('rankings.top4_total')} {player.topFour ?? 0}</>}</div></div>
                            <div className="shrink-0 text-base font-black text-primary sm:text-xl">{scope === 'winrate' ? `${player.winRate ?? 0}%` : <>{player.points ?? 0} <span className="text-xs">pts</span></>}</div>
                        </button>
                        {historyLoadingPlayerId === player.playerId && <div className="border-t border-primary/20 bg-primary/5 p-4 text-center text-sm text-muted-foreground">{t('rankings.history_loading')}</div>}
                        {historyPlayerId === player.playerId && history && <div className="space-y-3 border-t border-primary/20 bg-primary/5 p-3 sm:p-4"><div className="flex justify-between gap-3"><h2 className="min-w-0 text-base font-black sm:text-lg">{t('rankings.history')}: {history.player}</h2><button onClick={() => { setHistory(null); setHistoryPlayerId(null); }} className="shrink-0 text-sm text-muted-foreground">{t('rankings.close')}</button></div>{history.groups.map(group => <div key={group.name} className="rounded-lg border border-white/10 bg-black/20 p-3"><h3 className="font-bold text-primary">{t('rankings.name')}: {group.name}</h3>{group.results.map(result => <div key={`${result.tournament_id}-${result.placement}`} className="mt-3 flex flex-col items-start gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"><div className="min-w-0"><a href={result.tournament_url || '#'} target={result.tournament_external ? '_blank' : undefined} rel={result.tournament_external ? 'noreferrer' : undefined} className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline"><span className="break-words">{result.tournament_name}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></a><p className="text-xs text-muted-foreground">{t('rankings.hosted_by')}: {result.organizer_name}</p></div><span className="self-end whitespace-nowrap font-medium sm:self-auto">{t('rankings.placement')} {result.placement} • {result.points} {t('rankings.points')}</span></div>)}</div>)}</div>}
                        </div>
                    ))}
                </section>
            </div>
        </main>
    );
}
