'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Ban, ChevronDown, ExternalLink, GitMerge, Search, Trophy, History, Scissors } from 'lucide-react';
import { toast } from 'sonner';

type Player = { player_id: string; display_name: string; total_points: number; championships: number; top_four_finishes: number };
type HistoryGroup = { name: string; results: { tournament_id: string; tournament_name: string; organizer_name: string; tournament_url: string | null; tournament_external: boolean; placement: number; points: number; tournament_completed_at: string }[] };
type RankingTournament = { id: string; name: string; organizer_id: string; organizer_username: string; organizer_enabled: boolean; provider: string; status: string; created_at: string; challonge_url: string | null; is_excluded_from_rankings: boolean; automatically_excluded: boolean };

export default function PlayerManagementPage() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [query, setQuery] = useState('');
    const [primaryId, setPrimaryId] = useState('');
    const [primaryName, setPrimaryName] = useState('');
    const [mergeId, setMergeId] = useState('');
    const [busy, setBusy] = useState(false);
    const [history, setHistory] = useState<{ player: string; groups: HistoryGroup[] } | null>(null);
    const [historyPlayerId, setHistoryPlayerId] = useState('');
    const [historyLoading, setHistoryLoading] = useState(false);
    const [tournaments, setTournaments] = useState<RankingTournament[]>([]);
    const [isTournamentManagerOpen, setIsTournamentManagerOpen] = useState(false);

    const load = async (q = '') => {
        const res = await fetch(`/api/admin/players?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) return toast.error(data.error || 'โหลดรายชื่อไม่สำเร็จ');
        setPlayers(data.players || []);
    };
    useEffect(() => {
        const timer = setTimeout(() => { void load(); }, 0);
        return () => clearTimeout(timer);
    }, []);

    const loadTournaments = async () => {
        const res = await fetch('/api/admin/rankings/tournaments');
        const data = await res.json();
        if (!res.ok) return toast.error(data.error || 'Failed to load tournaments');
        setTournaments(data.tournaments || []);
    };
    useEffect(() => {
        const timer = setTimeout(() => { void loadTournaments(); }, 0);
        return () => clearTimeout(timer);
    }, []);

    const setTournamentExcluded = async (tournament: RankingTournament, excluded: boolean) => {
        const res = await fetch('/api/admin/rankings/tournaments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournamentId: tournament.id, excluded }) });
        const data = await res.json();
        if (!res.ok) return toast.error(data.error || 'Unable to update tournament');
        toast.success(excluded ? 'ตัดรายการออกจากตารางคะแนนแล้ว' : 'นำรายการกลับมานับคะแนนแล้ว');
        void loadTournaments();
        void load(query);
    };

    const setOrganizerEnabled = async (tournament: RankingTournament, enabled: boolean) => {
        const res = await fetch('/api/admin/rankings/tournaments', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_organizer_enabled', organizerId: tournament.organizer_id, enabled }),
        });
        const data = await res.json();
        if (!res.ok) return toast.error(data.error || 'Unable to update organizer approval');
        toast.success(enabled ? 'อนุญาตให้นับคะแนนของผู้จัดนี้แล้ว' : 'หยุดนับคะแนนและซ่อนประวัติของผู้จัดนี้แล้ว');
        void loadTournaments();
        void load(query);
    };

    const merge = async () => {
        if (!primaryId || !mergeId || primaryId === mergeId) return toast.error('เลือกชื่อหลักและชื่อที่จะรวมให้ต่างกัน');
        setBusy(true);
        const res = await fetch('/api/admin/players', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'merge', targetPlayerId: primaryId, sourcePlayerId: mergeId }) });
        const data = await res.json();
        setBusy(false);
        if (!res.ok) return toast.error(data.error || 'รวมชื่อไม่สำเร็จ');
        setMergeId('');
        toast.success('รวมชื่อและคะแนนเข้าชื่อหลักแล้ว');
        load(query);
    };

    const selectPlayer = (player: Player) => {
        if (!primaryId || primaryId === player.player_id) {
            const nextId = player.player_id === primaryId ? '' : player.player_id;
            setPrimaryId(nextId);
            setPrimaryName(nextId ? player.display_name : '');
            return;
        }
        setMergeId(player.player_id);
    };

    const renamePrimary = async () => {
        const name = primaryName.trim();
        if (!primaryId || !name) return toast.error('เลือกชื่อหลักและระบุชื่อใหม่ก่อน');
        setBusy(true);
        const res = await fetch('/api/admin/players', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rename', playerId: primaryId, displayName: name }) });
        const data = await res.json();
        setBusy(false);
        if (!res.ok) return toast.error(data.error || 'แก้ชื่อหลักไม่สำเร็จ');
        toast.success('แก้ชื่อหลักแล้ว');
        void load(query);
    };

    const showHistory = async (playerId: string) => {
        if (historyPlayerId === playerId) {
            setHistory(null);
            setHistoryPlayerId('');
            return;
        }
        setHistory(null);
        setHistoryPlayerId(playerId);
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/admin/players/${playerId}/history`);
            const data = await res.json();
            if (!res.ok) return toast.error(data.error || 'Failed to load history');
            setHistory(data);
        } finally {
            setHistoryLoading(false);
        }
    };

    const splitResult = async (result: HistoryGroup['results'][number], historicalName: string) => {
        if (!historyPlayerId) return;
        const suggestedName = `${historicalName} (${result.tournament_name})`;
        const displayName = window.prompt('ชื่อหลักใหม่ของผู้เล่นที่แยกออกมา (ต้องไม่ซ้ำกับชื่อเดิม)', suggestedName)?.trim();
        if (!displayName) return;
        setBusy(true);
        try {
            const res = await fetch('/api/admin/players', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'split_result', playerId: historyPlayerId, tournamentId: result.tournament_id, displayName }) });
            const data = await res.json();
            if (!res.ok) return toast.error(data.error || 'แยกรายการแข่งไม่สำเร็จ');
            toast.success(`แยก ${result.tournament_name} เป็น ${displayName} แล้ว`);
            await Promise.all([load(query), showHistory(historyPlayerId)]);
        } finally {
            setBusy(false);
        }
    };

    const tournamentsByOrganizer = tournaments.reduce<Record<string, RankingTournament[]>>((groups, tournament) => {
        (groups[tournament.organizer_id] ||= []).push(tournament);
        return groups;
    }, {});

    return <main className="min-h-screen bg-[#050505] p-3 text-white sm:p-6"><div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white"><ArrowLeft className="h-4 w-4" /> กลับแอดมิน</Link>
        <header><h1 className="flex items-center gap-2 text-2xl font-black sm:text-3xl"><GitMerge className="shrink-0 text-primary" /> ตรวจสอบและรวมชื่อผู้เล่น</h1><p className="mt-2 text-sm text-muted-foreground">ชื่อหลักที่เลือกจะคงอยู่ถาวร; alias และคะแนนทั้งหมดจะย้ายเข้าชื่อนั้น</p></header>
        <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4"><label className="text-sm font-bold">ค้นหาชื่อที่คล้ายกันเพื่อเปรียบเทียบ</label><div className="flex flex-col gap-2 sm:flex-row"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(query)} className="min-w-0 flex-1 rounded-lg bg-black/30 px-3 py-2" placeholder="เช่น TREX หรือ พจ" /><button onClick={() => load(query)} className="flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-black"><Search className="h-4 w-4" /></button></div></div>
        <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 sm:p-4"><button onClick={() => setIsTournamentManagerOpen(open => !open)} className="flex w-full items-center justify-between gap-3 text-left"><span><span className="flex items-center gap-2 font-black"><Ban className="h-4 w-4 shrink-0 text-red-400" /> จัดการรายการแข่งขันสำหรับคะแนน</span><span className="mt-1 block text-xs text-muted-foreground">แยกตาม user • ต้องอนุญาตผู้จัดก่อนจึงจะนับคะแนน • {tournaments.length} รายการ</span></span><ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${isTournamentManagerOpen ? 'rotate-180' : ''}`} /></button>{isTournamentManagerOpen && <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pr-1">{Object.entries(tournamentsByOrganizer).map(([organizerId, organizerTournaments]) => { const organizer = organizerTournaments[0]; return <details key={organizerId} className="rounded-lg border border-white/10 bg-black/20"><summary className="cursor-pointer list-none px-3 py-3 font-bold"><span className="flex items-center justify-between gap-3"><span className="break-words">{organizer.organizer_username}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">{organizerTournaments.length} รายการ</span></span></summary><div className="space-y-2 border-t border-white/10 p-2"><label className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm ${organizer.automatically_excluded ? 'border-red-500/20 bg-red-500/5 text-red-300' : organizer.organizer_enabled ? 'border-primary/30 bg-primary/10' : 'border-yellow-500/20 bg-yellow-500/5 text-yellow-200'}`}><span><span className="block font-bold">อนุญาตให้นับคะแนนจากผู้จัดนี้</span><span className="mt-0.5 block text-xs opacity-80">{organizer.automatically_excluded ? 'บัญชีทดสอบถูกตัดออกถาวร' : organizer.organizer_enabled ? 'การแข่งขันใหม่จะบันทึกคะแนนและประวัติได้' : 'ยังไม่คิดคะแนนหรือแสดงประวัติบนตารางคะแนน'}</span></span><input type="checkbox" className="h-4 w-4 accent-emerald-400" checked={organizer.organizer_enabled} disabled={organizer.automatically_excluded} onChange={event => void setOrganizerEnabled(organizer, event.target.checked)} /></label>{organizerTournaments.map(tournament => { const externalUrl = tournament.provider === 'CHALLONGE' ? tournament.challonge_url : null; return <div key={tournament.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words font-bold">{tournament.name}</p><p className="text-xs text-muted-foreground">{tournament.provider} · {new Date(tournament.created_at).toLocaleDateString('th-TH')}</p></div><div className="flex flex-wrap items-center gap-2"><a href={externalUrl || `/register/${tournament.id}`} target={externalUrl ? '_blank' : undefined} rel={externalUrl ? 'noreferrer' : undefined} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-black hover:bg-primary/90"><ExternalLink className="h-3.5 w-3.5" /> ดูการแข่งขัน</a>{tournament.automatically_excluded ? <span className="text-xs text-red-300">บัญชีทดสอบ — ตัดอัตโนมัติ</span> : !organizer.organizer_enabled ? <span className="text-xs text-yellow-200">รออนุญาตผู้จัด</span> : <button onClick={() => void setTournamentExcluded(tournament, !tournament.is_excluded_from_rankings)} className={`rounded-md px-3 py-1.5 text-xs font-bold ${tournament.is_excluded_from_rankings ? 'bg-zinc-700 text-white' : 'bg-red-500/15 text-red-300'}`}>{tournament.is_excluded_from_rankings ? 'นับคะแนนอีกครั้ง' : 'ตัดออกจากคะแนน'}</button>}</div></div>})}</div></details>})}</div>}</section>
        <div className="grid gap-3 md:grid-cols-2">{players.map(player => <div key={player.player_id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5"><button onClick={() => selectPlayer(player)} className={`w-full p-3 text-left sm:p-4 ${primaryId === player.player_id ? 'bg-green-500/10' : mergeId === player.player_id ? 'bg-orange-500/10' : ''}`}><div className="flex items-start justify-between gap-2"><span onClick={(event) => { event.stopPropagation(); void showHistory(player.player_id); }} className="flex min-w-0 items-center gap-1 font-bold hover:text-primary"><History className="h-4 w-4 shrink-0" /><span className="break-words">{player.display_name}</span></span><span className="shrink-0 text-primary"><Trophy className="inline h-4 w-4" /> {player.total_points}</span></div><p className="mt-1 text-xs text-muted-foreground">แชมป์ {player.championships} • Top 4 รวม {player.top_four_finishes}</p></button>{historyPlayerId === player.player_id && <div className="border-t border-primary/20 bg-primary/5 p-3 sm:p-4">{historyLoading ? <div className="py-5 text-center text-sm text-muted-foreground">กำลังโหลดประวัติ…</div> : history ? <><div className="flex items-start justify-between gap-3"><h2 className="min-w-0 font-black">ประวัติอันดับ: {history.player}</h2><button onClick={() => { setHistory(null); setHistoryPlayerId(''); }} className="shrink-0 text-sm text-muted-foreground">ปิด</button></div><p className="mt-1 text-xs text-muted-foreground">กด “แยกรายการนี้” เพื่อย้ายคะแนนของงานเดียวไปยังผู้เล่นใหม่</p><div className="mt-3 space-y-3">{history.groups.length === 0 ? <p className="text-sm text-muted-foreground">ยังไม่มีผลคะแนน</p> : history.groups.map(group => <div key={group.name} className="rounded-lg border border-white/10 bg-black/20 p-3"><h3 className="font-bold text-primary">ชื่อ: {group.name}</h3><div className="mt-2 space-y-3 text-sm">{group.results.map(result => <div key={`${result.tournament_id}-${result.placement}`} className="border-b border-white/5 pb-3 last:border-0 last:pb-0"><div className="min-w-0"><a href={result.tournament_url || '#'} target={result.tournament_external ? '_blank' : undefined} rel={result.tournament_external ? 'noreferrer' : undefined} className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline"><span className="break-words">{result.tournament_name}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" /><span className="shrink-0 text-muted-foreground">{new Date(result.tournament_completed_at).toLocaleDateString('th-TH')}</span></a><p className="text-xs text-muted-foreground">จัดโดย: {result.organizer_name}</p></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs sm:text-sm">อันดับ {result.placement} • {result.points} คะแนน</span><button disabled={busy} onClick={() => void splitResult(result, group.name)} className="inline-flex items-center gap-1 rounded-md bg-orange-500/15 px-2 py-1 text-xs font-bold text-orange-300 hover:bg-orange-500/25 disabled:opacity-50"><Scissors className="h-3.5 w-3.5" /> แยกรายการนี้</button></div></div>)}</div></div>)}</div></> : null}</div>}</div>)}</div>
        <div className="sticky bottom-3 space-y-3 rounded-xl border border-white/10 bg-zinc-900 p-3 sm:bottom-4 sm:p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="break-words text-sm">ชื่อหลัก: <b>{players.find(p => p.player_id === primaryId)?.display_name || '-'}</b> ← รวม: <b>{players.find(p => p.player_id === mergeId)?.display_name || '-'}</b></span><button disabled={busy || !primaryId || !mergeId} onClick={merge} className="w-full rounded-lg bg-primary px-4 py-2 font-bold text-black disabled:opacity-40 sm:w-auto">{busy ? 'กำลังรวม…' : 'รวมชื่อและคะแนน'}</button></div>{primaryId && <div className="flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center"><label className="text-sm font-bold">แก้ชื่อหลัก</label><input value={primaryName} onChange={event => setPrimaryName(event.target.value)} className="min-w-0 w-full flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" /><button disabled={busy || !primaryName.trim()} onClick={renamePrimary} className="w-full rounded-lg bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-40 sm:w-auto">บันทึกชื่อ</button></div>}</div>
    </div></main>;
}
