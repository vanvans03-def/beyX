import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { ZoomIn, ZoomOut, RefreshCw, Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface InternalMatch {
    id: string;
    player1_id: string | null;
    player2_id: string | null;
    winner_id: string | null;
    round: number;
    state: string;
    scores_csv: string;
    player1?: { name: string } | null;
    player2?: { name: string } | null;
    player1_prereq_match_id?: string | null;
    player2_prereq_match_id?: string | null;
    loser_to_match_id?: string | null;
    is_grand_final?: boolean;
    is_reset_match?: boolean;
    is_seeding_bye?: boolean;
    suggested_play_order?: number;
}

interface Props {
    matches: InternalMatch[];
    onReportWin?: (match: InternalMatch, winnerId: string, winnerName: string, scores: string) => void;
    provider?: string;
    tournamentId?: string;
    participantNames?: string[];
}

type BadgePeriod = { rank: number; period: string };
type BadgeHistoryEntry = {
    type: 'monthly' | 'yearly' | 'winrate';
    rank: number;
    period: string;
    points?: number;
    championships?: number;
    topFour?: number;
    wins: number;
    matches: number;
    winRate?: number;
};
type PlayerRankingBadges = {
    monthly?: number;
    yearly?: number;
    winrate?: number;
    monthlyPeriods?: BadgePeriod[];
    winratePeriods?: BadgePeriod[];
    history?: BadgeHistoryEntry[];
};

const normalizeBadgeName = (name: string) => name.normalize('NFKC').trim().toLocaleLowerCase('th-TH').replace(/\s+/g, ' ');

function BadgeImage({ rank, period, history, size = 18, muted = false }: { rank: number; period: 'M' | 'Y' | 'W'; history?: BadgePeriod[]; size?: number; muted?: boolean }) {
    return <img
        src={`/images/badge/${period === 'W' ? `w${rank}` : `${rank}${period}`}-Photoroom.webp`}
        alt={`${period === 'M' ? 'Monthly' : period === 'Y' ? 'Yearly' : 'Win Rate'} Top ${rank}`}
        title={`${period === 'M' ? 'Monthly' : period === 'Y' ? 'Yearly' : 'Win Rate'} Top ${rank}${history?.length ? `\n${history.map(entry => `${entry.period}: Top ${entry.rank}`).join('\n')}` : ''}`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        data-badge-muted={muted ? 'true' : undefined}
        style={{
            width: size,
            height: size,
            objectFit: 'contain',
            flexShrink: 0,
            filter: muted ? 'grayscale(1)' : undefined,
            opacity: muted ? 0.58 : 1,
        }}
    />;
}

function RankingBadges({ badges }: { badges?: PlayerRankingBadges }) {
    if (!badges?.monthly && !badges?.yearly && !badges?.winrate) return null;
    return <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0, marginLeft: 3, alignItems: 'center' }}>
        {badges.monthly && <BadgeImage rank={badges.monthly} period="M" history={badges.monthlyPeriods} />}
        {badges.yearly && <BadgeImage rank={badges.yearly} period="Y" />}
        {badges.winrate && <BadgeImage rank={badges.winrate} period="W" history={badges.winratePeriods} />}
    </span>;
}

function BracketPlayerName({ name, badges, fallback, onShowBadgeHistory }: {
    name?: string;
    badges?: PlayerRankingBadges;
    fallback: React.ReactNode;
    onShowBadgeHistory: (name: string, badges: PlayerRankingBadges) => void;
}) {
    const hasBadgeHistory = Boolean(badges?.history?.length);
    return <span style={{ display: 'flex', minWidth: 0, flex: 1, alignItems: 'center', fontSize: 13, maxWidth: 158 }}>
        {name ? (hasBadgeHistory ? <button
            type="button"
            title={name}
            data-badge-history-player={name}
            onClick={event => {
                event.stopPropagation();
                onShowBadgeHistory(name, badges!);
            }}
            style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: 0, padding: 0, background: 'transparent', color: 'inherit', font: 'inherit', fontWeight: 'inherit', textAlign: 'left', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(134, 239, 172, .45)', textUnderlineOffset: 2 }}
        >{name}</button> : <span title={name} style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>) : fallback}
        <RankingBadges badges={badges} />
    </span>;
}

function formatBadgePeriod(entry: BadgeHistoryEntry, lang: 'TH' | 'EN') {
    if (entry.type === 'yearly') return lang === 'TH' ? `ปี ${Number(entry.period) + 543}` : entry.period;
    const [year, month] = entry.period.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(lang === 'TH' ? 'th-TH' : 'en-US', {
        month: 'long', year: 'numeric', timeZone: 'UTC',
    });
}

function sortBadgeHistory(entries: BadgeHistoryEntry[] = []) {
    return [...entries].sort((a, b) =>
        Number(b.type === 'yearly') - Number(a.type === 'yearly')
    );
}

const CARD_W = 200;
const CARD_H = 62;
const CONNECTOR_W = 56;
const UNIT_BASE = CARD_H + 28;

/** Y center of a card at (roundIdx, slotIdx) */
function cardCenterY(slotIdx: number, roundIdx: number, UNIT: number): number {
    const step = UNIT * Math.pow(2, roundIdx);
    return slotIdx * step + (step - UNIT) / 2 + CARD_H / 2;
}
function cardTopY(slotIdx: number, roundIdx: number, UNIT: number): number {
    return cardCenterY(slotIdx, roundIdx, UNIT) - CARD_H / 2;
}

function isBracketMatchHidden(match: InternalMatch, allMatches: InternalMatch[]): boolean {
    const winnerBracketFeeders = allMatches.filter(candidate => candidate.loser_to_match_id === match.id);
    const isSingleDropBye = winnerBracketFeeders.length === 1
        && !match.player1_prereq_match_id
        && !match.player2_prereq_match_id;

    return Boolean(
        match.scores_csv?.includes('BYE')
        || (match.state?.toUpperCase() === 'COMPLETE' && (!match.player1_id || !match.player2_id) && !match.is_grand_final)
        || isSingleDropBye
    );
}

// ─── Match Card ───────────────────────────────────────────────────────────────
function MatchCard({ match, onReportWin, matchNum, loserOfNums, numMap, t, searchQuery, activeMatchId, badgesByName, onShowBadgeHistory }: {
    match: InternalMatch;
    onReportWin?: (m: InternalMatch, winnerId: string, winnerName: string, scores: string) => void;
    matchNum?: number;
    loserOfNums?: [number | undefined, number | undefined];
    numMap?: Map<string, number>;
    t: any;
    searchQuery: string;
    activeMatchId?: string;
    badgesByName: Record<string, PlayerRankingBadges>;
    onShowBadgeHistory: (name: string, badges: PlayerRankingBadges) => void;
}) {
    const isOpen = match.state?.toUpperCase() === 'OPEN';
    const isComplete = match.state?.toUpperCase() === 'COMPLETE';
    const isBye = match.scores_csv?.includes('BYE');
    const p1 = match.player1?.name;
    const p2 = match.player2?.name;
    const p1Badges = p1 ? badgesByName[normalizeBadgeName(p1)] : undefined;
    const p2Badges = p2 ? badgesByName[normalizeBadgeName(p2)] : undefined;
    const scores = match.scores_csv?.split('-') ?? [];
    const p1Won = isComplete && match.winner_id === match.player1_id && !!match.winner_id;
    const p2Won = isComplete && match.winner_id === match.player2_id && !!match.winner_id;
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    const p1MatchesSearch = !!normalizedQuery && !!p1?.toLocaleLowerCase().includes(normalizedQuery);
    const p2MatchesSearch = !!normalizedQuery && !!p2?.toLocaleLowerCase().includes(normalizedQuery);
    const isSearchMatch = p1MatchesSearch || p2MatchesSearch;
    const isSearchTarget = isSearchMatch && match.id === activeMatchId;

    if (isBye) return null;

    return (
        <div
            data-bracket-match-id={match.id}
            data-search-match={isSearchMatch ? 'true' : undefined}
            style={{
                display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'auto', userSelect: 'none',
                filter: isSearchMatch ? 'drop-shadow(0 0 10px rgba(134, 239, 172, 0.38))' : undefined,
                transition: 'filter 180ms ease',
            }}
        >
            {matchNum !== undefined && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', minWidth: 18, textAlign: 'right', flexShrink: 0 }}>
                    {matchNum}
                </span>
            )}

            <div
                style={{
                    width: CARD_W, height: CARD_H,
                    display: 'flex', flexDirection: 'column',
                    border: isSearchMatch ? '2px solid #86efac' : isComplete ? '1px solid #3f6212' : isOpen ? '1px solid #3f3f46' : '1px solid #27272a',
                    borderRadius: 8, overflow: 'hidden',
                    cursor: 'default',
                    position: 'relative', flexShrink: 0,
                    background: 'linear-gradient(135deg, #19191d 0%, #101012 100%)',
                    boxShadow: isSearchMatch ? '0 0 0 2px rgba(134, 239, 172, 0.15), 0 0 20px rgba(134, 239, 172, 0.3)' : isComplete ? '0 3px 12px rgba(134, 239, 172, 0.08)' : '0 3px 12px rgba(0, 0, 0, 0.18)',
                    transition: 'border-color 180ms ease, box-shadow 180ms ease',
                    animation: isSearchMatch ? `bracketSearchGlow ${isSearchTarget ? '2s' : '2.8s'} ease-in-out infinite` : undefined,
                }}
            >
                {isOpen && (
                    <div style={{ position: 'absolute', top: 5, right: 6, width: 5, height: 5, borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
                )}
                {/* P1 */}
                <div
                    style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 10px', borderBottom: '1px solid #27272a',
                        background: p1Won ? 'linear-gradient(90deg, #202a23 0%, #1d211e 70%, #1c1c1e 100%)' : p1MatchesSearch ? 'linear-gradient(90deg, #203126 0%, #1c1c1e 85%)' : '#1c1c1e',
                        boxShadow: p1Won ? 'inset 3px 0 0 #86efac' : p1MatchesSearch ? 'inset 3px 0 0 #86efac' : undefined,
                    }}
                >
                    <span style={{ display: 'flex', minWidth: 0, flex: 1, color: p2Won ? '#a1a1aa' : '#f4f4f5', fontWeight: p1Won ? 700 : 500 }}><BracketPlayerName name={p1} badges={p1Badges} onShowBadgeHistory={onShowBadgeHistory} fallback={
                            <em style={{ color: '#71717a', fontStyle: 'normal', fontSize: 12 }}>
                                {loserOfNums?.[0] !== undefined 
                                    ? t('bracket.loser_of' as any, { n: loserOfNums[0] }) 
                                    : (match.player1_prereq_match_id && numMap?.get(match.player1_prereq_match_id) !== undefined
                                        ? t('bracket.winner_of' as any, { n: numMap.get(match.player1_prereq_match_id) })
                                        : 'TBD')}
                            </em>
                        } /></span>
                    {isComplete && <span style={{ fontSize: 13, fontWeight: 700, color: p1Won ? '#f4f4f5' : '#71717a', minWidth: 18, textAlign: 'right' }}>{scores[0] ?? 0}</span>}
                </div>
                {/* P2 */}
                <div
                    style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 10px',
                        background: p2Won ? 'linear-gradient(90deg, #202a23 0%, #1d211e 70%, #1c1c1e 100%)' : p2MatchesSearch ? 'linear-gradient(90deg, #203126 0%, #1c1c1e 85%)' : '#1c1c1e',
                        boxShadow: p2Won ? 'inset 3px 0 0 #86efac' : p2MatchesSearch ? 'inset 3px 0 0 #86efac' : undefined,
                    }}
                >
                    <span style={{ display: 'flex', minWidth: 0, flex: 1, color: p1Won ? '#a1a1aa' : '#f4f4f5', fontWeight: p2Won ? 700 : 500 }}><BracketPlayerName name={p2} badges={p2Badges} onShowBadgeHistory={onShowBadgeHistory} fallback={
                            <em style={{ color: '#71717a', fontStyle: 'normal', fontSize: 12 }}>
                                {loserOfNums?.[1] !== undefined 
                                    ? t('bracket.loser_of' as any, { n: loserOfNums[1] }) 
                                    : (match.player2_prereq_match_id && numMap?.get(match.player2_prereq_match_id) !== undefined
                                        ? t('bracket.winner_of' as any, { n: numMap.get(match.player2_prereq_match_id) })
                                        : 'TBD')}
                            </em>
                        } /></span>
                    {isComplete && <span style={{ fontSize: 13, fontWeight: 700, color: p2Won ? '#f4f4f5' : '#71717a', minWidth: 18, textAlign: 'right' }}>{scores[1] ?? 0}</span>}
                </div>
            </div>
        </div>
    );
}

// ─── Bracket Section with SVG connectors ─────────────────────────────────────
function BracketSection({
    rounds,
    onReportWin,
    slotMap,
    UNIT,
    numMap,
    allMatches,
    yMap,
    t,
    searchQuery,
    activeMatchId,
    badgesByName,
    onShowBadgeHistory,
}: {
    rounds: { label: string; matches: InternalMatch[]; isQualify: boolean }[];
    onReportWin?: (m: InternalMatch, winnerId: string, winnerName: string, scores: string) => void;
    slotMap: Map<string, number>;
    UNIT: number;
    numMap: Map<string, number>;
    allMatches: InternalMatch[];
    yMap: Map<string, number>;
    t: any;
    searchQuery: string;
    activeMatchId?: string;
    badgesByName: Record<string, PlayerRankingBadges>;
    onShowBadgeHistory: (name: string, badges: PlayerRankingBadges) => void;
}) {
    const r1Count = rounds[0]?.matches.length ?? 0;
    const totalH = r1Count * UNIT + 40;
    const sectionMatchIds = new Set(rounds.flatMap(round => round.matches.map(match => match.id)));
    const visibleSectionMatchIds = new Set(rounds.flatMap(round => round.matches)
        .filter(match => !isBracketMatchHidden(match, allMatches))
        .map(match => match.id));
    const connectorPrefix = rounds.some(round => round.matches.some(match => match.round < 0)) ? 'losers' : 'winners';

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {rounds.map((round, ri) => {
                const prevRound = ri > 0 ? rounds[ri - 1] : null;

                return (
                    <React.Fragment key={ri}>
                        {prevRound && (
                            <svg width={CONNECTOR_W} height={totalH + 40} style={{ flexShrink: 0, overflow: 'hidden', marginTop: 28 }}>
                                <defs>
                                    <linearGradient
                                        id={`bracket-connector-${connectorPrefix}-${ri}`}
                                        gradientUnits="userSpaceOnUse"
                                        x1={0}
                                        x2={CONNECTOR_W}
                                        y1={0}
                                        y2={0}
                                    >
                                        <stop offset="0%" stopColor="#3f3f46" />
                                        <stop offset="52%" stopColor="#71717a" />
                                        <stop offset="100%" stopColor="#22c55e" />
                                    </linearGradient>
                                </defs>
                                {round.matches.map(m => {
                                    if (!visibleSectionMatchIds.has(m.id)) return null;

                                    const myY = yMap.get(m.id) ?? 0;
                                    const cx = CONNECTOR_W / 2;
                                    const lines: React.ReactNode[] = [];

                                    // Each BracketSection has its own coordinate origin. Cross-section
                                    // drops (WB -> LB and LB -> GF) are represented by player/loser labels,
                                    // not SVG paths, because their Y values belong to a different canvas.
                                    const prerequisiteFeeders = [m.player1_prereq_match_id, m.player2_prereq_match_id]
                                        .filter((id): id is string => Boolean(id))
                                        .map(id => allMatches.find(candidate => candidate.id === id))
                                        .filter((candidate): candidate is InternalMatch => Boolean(candidate))
                                        .filter(candidate => sectionMatchIds.has(candidate.id)
                                            && visibleSectionMatchIds.has(candidate.id));
                                    const loserFeeders = allMatches.filter(pm =>
                                        pm.loser_to_match_id === m.id &&
                                        sectionMatchIds.has(pm.id) &&
                                        visibleSectionMatchIds.has(pm.id)
                                    );
                                    const feederYs = [...new Map([...prerequisiteFeeders, ...loserFeeders]
                                        .map(feeder => [feeder.id, yMap.get(feeder.id)]))
                                        .values()]
                                        .filter((y): y is number => y !== undefined);

                                    feederYs.forEach((feederY, idx) => {
                                        lines.push(<path key={`feeder-${idx}`} d={`M 0 ${feederY} H ${cx} V ${myY}`} fill="none" stroke={`url(#bracket-connector-${connectorPrefix}-${ri})`} strokeWidth="1.75" strokeLinejoin="round" />);
                                    });
                                    if (feederYs.length > 0) {
                                        lines.push(<path key="out" d={`M ${cx} ${myY} H ${CONNECTOR_W}`} fill="none" stroke={`url(#bracket-connector-${connectorPrefix}-${ri})`} strokeWidth="1.75" />);
                                    }

                                    return <g key={m.id}>{lines}</g>;
                                })}
                            </svg>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{
                                width: CARD_W + 22, textAlign: 'center',
                                fontSize: 11, fontWeight: 700, color: '#a1a1aa',
                                letterSpacing: '0.1em', textTransform: 'uppercase',
                                marginBottom: 10, paddingBottom: 4,
                                borderBottom: '1px solid #27272a',
                            }}>
                                {round.label}
                            </div>

                            <div style={{ position: 'relative', width: CARD_W + 22, height: totalH }}>
                                {round.matches.map(m => {
                                    if (!visibleSectionMatchIds.has(m.id)) return null;

                                    const topY = (yMap.get(m.id) ?? 0) - CARD_H / 2;
                                    const num = numMap.get(m.id);
                                    const loserOfNums = (m as any)._loserOfNums;

                                    return (
                                        <div key={m.id} style={{ position: 'absolute', top: topY, left: 0 }}>
                                            <MatchCard
                                                match={m}
                                                onReportWin={onReportWin}
                                                matchNum={num}
                                                loserOfNums={loserOfNums}
                                                numMap={numMap}
                                                t={t}
                                                searchQuery={searchQuery}
                                                activeMatchId={activeMatchId}
                                                badgesByName={badgesByName}
                                                onShowBadgeHistory={onShowBadgeHistory}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const InternalBracket: React.FC<Props> = ({ matches, onReportWin, tournamentId, participantNames }) => {
    const { t, lang } = useTranslation();
    
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const [scale, setScale] = useState(0.85);
    const [isDragging, setIsDragging] = useState(false);
    const [isPinching, setIsPinching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLane, setSearchLane] = useState<'upper' | 'lower'>('upper');
    const [badgesByName, setBadgesByName] = useState<Record<string, PlayerRankingBadges>>({});
    const [selectedBadgeHistory, setSelectedBadgeHistory] = useState<{ name: string; badges: PlayerRankingBadges } | null>(null);
    const badgePlayerKey = JSON.stringify(
        [...new Set((participantNames?.length
            ? participantNames
            : matches.flatMap(match => [match.player1?.name, match.player2?.name])
        ).filter((name): name is string => Boolean(name?.trim())))]
            .sort((a, b) => normalizeBadgeName(a).localeCompare(normalizeBadgeName(b), 'th')),
    );

    useEffect(() => {
        const names = JSON.parse(badgePlayerKey) as string[];
        if (!names.length) { setBadgesByName({}); return; }
        const params = new URLSearchParams();
        names.forEach(name => params.append('name', name));
        if (tournamentId) params.set('tournamentId', tournamentId);
        let cancelled = false;
        fetch(`/api/public/rankings/badges?${params.toString()}`)
            .then(response => response.ok ? response.json() : { badges: {} })
            .then(data => { if (!cancelled) setBadgesByName(data.badges || {}); })
            .catch(() => { if (!cancelled) setBadgesByName({}); });
        return () => { cancelled = true; };
    }, [badgePlayerKey, tournamentId]);

    const currentPosition = useRef({ x: 40, y: 40 });
    const scaleRef = useRef(0.85);
    const dragStart = useRef({ x: 0, y: 0 });
    const isPointerDown = useRef(false);

    const initialTouchDistance = useRef<number | null>(null);
    const initialScale = useRef<number>(1.0);
    const searchWasActive = useRef(false);
    const viewBeforeSearch = useRef({ x: 40, y: 40, scale: 0.85 });

    const searchResults = useMemo(() => {
        const query = searchQuery.trim().toLocaleLowerCase();
        if (!query) return { upper: [] as InternalMatch[], lower: [] as InternalMatch[] };
        const found = matches.filter((match) =>
            match.player1?.name?.toLocaleLowerCase().includes(query) ||
            match.player2?.name?.toLocaleLowerCase().includes(query)
        );
        const latestFirst = (items: InternalMatch[]) => [...items].sort((a, b) =>
            (b.suggested_play_order ?? 0) - (a.suggested_play_order ?? 0)
        );
        return {
            upper: latestFirst(found.filter((match) => match.round > 0 || match.is_grand_final)),
            lower: latestFirst(found.filter((match) => match.round < 0)),
        };
    }, [matches, searchQuery]);

    const activeSearchLane = searchLane === 'lower'
        ? (searchResults.lower.length > 0 ? 'lower' : 'upper')
        : (searchResults.upper.length > 0 ? 'upper' : 'lower');
    const activeMatchIds = searchResults[activeSearchLane].map((match) => match.id);
    const activeMatchId = activeMatchIds[0];

    useEffect(() => {
        setSearchLane('upper');
    }, [searchQuery]);

    useEffect(() => {
        const query = searchQuery.trim();
        if (!query) {
            if (searchWasActive.current) {
                searchWasActive.current = false;
                currentPosition.current = { x: viewBeforeSearch.current.x, y: viewBeforeSearch.current.y };
                scaleRef.current = viewBeforeSearch.current.scale;
                setScale(viewBeforeSearch.current.scale);
                updateTransform(viewBeforeSearch.current.x, viewBeforeSearch.current.y, viewBeforeSearch.current.scale);
            }
            return;
        }
        if (!containerRef.current || !contentRef.current) return;
        if (!searchWasActive.current) {
            searchWasActive.current = true;
            viewBeforeSearch.current = { ...currentPosition.current, scale: scaleRef.current };
        }

        const frame = requestAnimationFrame(() => {
            const target = activeMatchIds
                .map((matchId) => contentRef.current?.querySelector<HTMLElement>(`[data-bracket-match-id="${matchId}"]`))
                .find((element): element is HTMLElement => !!element);
            const container = containerRef.current;
            const content = contentRef.current;
            if (!target || !container || !content) return;

            const targetRect = target.getBoundingClientRect();
            const contentRect = content.getBoundingClientRect();
            const nextScale = Math.max(scaleRef.current, 1.05);
            const targetX = (targetRect.left - contentRect.left) / scaleRef.current;
            const targetY = (targetRect.top - contentRect.top) / scaleRef.current;
            const rawX = container.clientWidth / 2 - (targetX + CARD_W / 2) * nextScale;
            const rawY = container.clientHeight / 2 - (targetY + CARD_H / 2) * nextScale;
            const clamped = clampPosition(rawX, rawY, nextScale);
            currentPosition.current = clamped;
            scaleRef.current = nextScale;
            setScale(nextScale);
            updateTransform(clamped.x, clamped.y, nextScale);
        });

        return () => cancelAnimationFrame(frame);
    // Focus only when the query or match data changes, not after every zoom gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, matches, activeSearchLane, activeMatchId]);

    const updateTransform = (x: number, y: number, currentScale: number) => {
        if (contentRef.current) {
            contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${currentScale})`;
        }
    };

    const clampPosition = (x: number, y: number, currentScale: number) => {
        if (!containerRef.current || !contentRef.current) return { x, y };

        const viewportW = containerRef.current.clientWidth;
        const viewportH = containerRef.current.clientHeight;

        const contentW = contentRef.current.scrollWidth * currentScale;
        const contentH = contentRef.current.scrollHeight * currentScale;

        const padX = 80;
        const padY = 80;

        const minX = contentW < viewportW ? -padX : viewportW - contentW - padX;
        const maxX = contentW < viewportW ? viewportW - contentW + padX : padX;
        const minY = contentH < viewportH ? -padY : viewportH - contentH - padY;
        const maxY = contentH < viewportH ? viewportH - contentH + padY : padY;

        const clampedX = Math.max(minX, Math.min(maxX, x));
        const clampedY = Math.max(minY, Math.min(maxY, y));

        return { x: clampedX, y: clampedY };
    };

    const adjustZoom = (newScale: number) => {
        if (!containerRef.current || !contentRef.current) return;

        const viewportW = containerRef.current.clientWidth;
        const viewportH = containerRef.current.clientHeight;

        const cx = viewportW / 2;
        const cy = viewportH / 2;

        const x = currentPosition.current.x;
        const y = currentPosition.current.y;

        const ratio = newScale / scaleRef.current;
        const rawX = cx - (cx - x) * ratio;
        const rawY = cy - (cy - y) * ratio;

        const clamped = clampPosition(rawX, rawY, newScale);
        currentPosition.current = clamped;
        scaleRef.current = newScale;
        setScale(newScale);
        updateTransform(clamped.x, clamped.y, newScale);
    };

    const resetToLeftFocus = () => {
        const defaultScale = 0.85;
        scaleRef.current = defaultScale;
        setScale(defaultScale);

        if (containerRef.current && contentRef.current) {
            const viewportH = containerRef.current.clientHeight;
            const contentH = contentRef.current.scrollHeight * defaultScale;

            const y = contentH < viewportH ? (viewportH - contentH) / 2 : 40;
            const x = 40;

            currentPosition.current = { x, y };
            updateTransform(x, y, defaultScale);
        } else {
            currentPosition.current = { x: 40, y: 40 };
            updateTransform(40, 40, defaultScale);
        }
    };

    const prevMatchIdsKeyRef = useRef('');

    useEffect(() => {
        if (matches && matches.length > 0) {
            const currentKey = matches.map(m => m.id).join(',');
            if (currentKey !== prevMatchIdsKeyRef.current) {
                prevMatchIdsKeyRef.current = currentKey;
                const timer = setTimeout(() => {
                    resetToLeftFocus();
                }, 100);
                return () => clearTimeout(timer);
            }
        }
    }, [matches]);

    useEffect(() => {
        const handleResize = () => {
            const clamped = clampPosition(currentPosition.current.x, currentPosition.current.y, scale);
            currentPosition.current = clamped;
            updateTransform(clamped.x, clamped.y, scale);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [scale]);

    // Native wheel zoom listener (zoom to cursor position)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomFactor = 0.05;
            const direction = e.deltaY < 0 ? 1 : -1;
            const currentScale = scaleRef.current;
            const newScale = Math.max(0.15, Math.min(2.0, currentScale + direction * zoomFactor));

            if (newScale !== currentScale) {
                const x = currentPosition.current.x;
                const y = currentPosition.current.y;
                const ratio = newScale / currentScale;

                const rawX = mouseX - (mouseX - x) * ratio;
                const rawY = mouseY - (mouseY - y) * ratio;

                const clamped = clampPosition(rawX, rawY, newScale);
                currentPosition.current = clamped;
                scaleRef.current = newScale;
                setScale(newScale);
                updateTransform(clamped.x, clamped.y, newScale);
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, [scale]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        isPointerDown.current = true;
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - currentPosition.current.x,
            y: e.clientY - currentPosition.current.y
        };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPointerDown.current) return;
        
        const rawX = e.clientX - dragStart.current.x;
        const rawY = e.clientY - dragStart.current.y;
        
        const clamped = clampPosition(rawX, rawY, scaleRef.current);
        currentPosition.current = clamped;
        updateTransform(clamped.x, clamped.y, scaleRef.current);
    };

    const handleMouseUp = () => {
        isPointerDown.current = false;
        setIsDragging(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            isPointerDown.current = true;
            setIsDragging(true);
            const touch = e.touches[0];
            dragStart.current = {
                x: touch.clientX - currentPosition.current.x,
                y: touch.clientY - currentPosition.current.y
            };
            initialTouchDistance.current = null;
        } else if (e.touches.length === 2) {
            isPointerDown.current = false;
            setIsDragging(false);
            setIsPinching(true);
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            initialTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
            initialScale.current = scaleRef.current;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && isPointerDown.current) {
            const touch = e.touches[0];
            const rawX = touch.clientX - dragStart.current.x;
            const rawY = touch.clientY - dragStart.current.y;
            
            const clamped = clampPosition(rawX, rawY, scaleRef.current);
            currentPosition.current = clamped;
            updateTransform(clamped.x, clamped.y, scaleRef.current);
        } else if (e.touches.length === 2 && initialTouchDistance.current !== null) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const factor = distance / initialTouchDistance.current;
            const newScale = Math.max(0.15, Math.min(2.0, initialScale.current * factor));
            
            const pX = (t1.clientX + t2.clientX) / 2;
            const pY = (t1.clientY + t2.clientY) / 2;

            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const localCenterX = pX - rect.left;
                const localCenterY = pY - rect.top;

                const dxZoom = localCenterX - currentPosition.current.x;
                const dyZoom = localCenterY - currentPosition.current.y;
                const ratio = newScale / scaleRef.current;

                const rawX = localCenterX - dxZoom * ratio;
                const rawY = localCenterY - dyZoom * ratio;

                const clamped = clampPosition(rawX, rawY, newScale);
                currentPosition.current = clamped;
                scaleRef.current = newScale;
                updateTransform(clamped.x, clamped.y, newScale);
            }
        }
    };

    const handleTouchEnd = () => {
        isPointerDown.current = false;
        setIsDragging(false);
        initialTouchDistance.current = null;
        setIsPinching(false);
        setScale(scaleRef.current);
    };

    const { winnersRounds = [], losersRounds = [], slotMap = new Map(), UNIT = UNIT_BASE, numMap = new Map(), yMap = new Map() } = useMemo(() => {

        if (!matches || !matches.length) return { winnersRounds: [], losersRounds: [], slotMap: new Map<string, number>(), UNIT: UNIT_BASE, numMap: new Map<string, number>(), yMap: new Map<string, number>() };

        const ws = matches.filter(m => m.round > 0 || m.is_grand_final).sort((a, b) => a.round - b.round);
        const ls = matches.filter(m => m.round < 0).sort((a, b) => Math.abs(a.round) - Math.abs(b.round));

        const wRoundNums = [...new Set(ws.map(m => m.round))].sort((a, b) => a - b);
        const lRoundNums = [...new Set(ls.map(m => m.round))].sort((a, b) => Math.abs(a) - Math.abs(b));

        const wGroups = wRoundNums.map(r => ws.filter(m => m.round === r));
        const lGroups = lRoundNums.map(r => ls.filter(m => m.round === r));

        const slotMap = new Map<string, number>();

        // 1. Winners slots (Backward Traversal from Final)
        // Find the root(s) of the winners bracket.
        const winnersMatches = ws;
        const grandFinalMatch = winnersMatches.find(m => m.is_grand_final);
        const maxRound = Math.max(...winnersMatches.map(m => m.round), 1);
        const finalMatches = winnersMatches.filter(m => m.round === maxRound);

        const roots = grandFinalMatch ? [grandFinalMatch] : finalMatches;

        roots.forEach((root) => {
            const queue = [{ id: root.id, slot: 0 }];
            const visited = new Set<string>();
            while (queue.length > 0) {
                const { id, slot } = queue.shift()!;
                if (visited.has(id)) continue;
                visited.add(id);

                const m = winnersMatches.find(xm => xm.id === id);
                if (!m) continue;

                // Set slot for all matches (including BYEs) to maintain correct tree alignment
                slotMap.set(id, slot);

                if (m.player1_prereq_match_id) {
                    const p1m = winnersMatches.find(x => x.id === m.player1_prereq_match_id);
                    if (p1m?.scores_csv?.includes('BYE')) {
                        // BYE match — ใช้ slot เดิม ไม่ขยาย
                        queue.push({ id: m.player1_prereq_match_id, slot: slot * 2 });
                    } else {
                        queue.push({ id: m.player1_prereq_match_id, slot: slot * 2 });
                    }
                }
                if (m.player2_prereq_match_id) {
                    queue.push({ id: m.player2_prereq_match_id, slot: slot * 2 + 1 });
                }
            }
        });


        // 2. Losers slots — sort-key approach to prevent line crossings
        // For each LB round, compute a spatial sort key from feeders, then
        // assign sequential slots 0,1,2,… so lines never cross.
        lGroups.forEach((group, gi) => {
            const lbRoundNum = gi + 1;
            const isMixing = lbRoundNum % 2 === 0;

            // Build (match, sortKey) pairs
            const keyed = group.map((m, i) => {
                let sortKey = i; // fallback

                if (gi === 0) {
                    // LB R1: sort by the slots of their WB Round 1 feeders to preserve correct spatial order
                    const wbFeeders = ws.filter(wm => wm.loser_to_match_id === m.id);
                    const slots = wbFeeders.map(wm => slotMap.get(wm.id)).filter(s => s !== undefined) as number[];
                    if (slots.length > 0) {
                        sortKey = Math.min(...slots);
                    } else {
                        sortKey = i;
                    }
                } else if (isMixing) {
                    // Mixing round: sort by LB prerequisite slot to keep lines straight
                    // (WB feeder slot is reversed for anti-rematch, don't use it for positioning)
                    const prereqSlot = slotMap.get(m.player1_prereq_match_id ?? '');
                    if (prereqSlot !== undefined) {
                        sortKey = prereqSlot;
                    }
                } else {
                    // Culling round: two LB matches merge — sort by average prereq slots
                    const s1 = slotMap.get(m.player1_prereq_match_id ?? '');
                    const s2 = slotMap.get(m.player2_prereq_match_id ?? '');
                    if (s1 !== undefined && s2 !== undefined) {
                        sortKey = (s1 + s2) / 2;
                    } else if (s1 !== undefined) {
                        sortKey = s1;
                    } else if (s2 !== undefined) {
                        sortKey = s2;
                    }
                }
                return { m, sortKey };
            });

            // Sort by key to maintain spatial order, assign sequential slots
            keyed.sort((a, b) => a.sortKey - b.sortKey);
            keyed.forEach((entry, idx) => {
                slotMap.set(entry.m.id, idx);
            });
        });

        // LB slot compaction removed to preserve binary tree alignment and prevent overlaps



        // Removed WB R1 slot compaction. Pure binary tree structure must be preserved
        // to prevent line/box overlaps when calculating geometric coordinates.


        const r1HasByes = wGroups[0]?.some(m => m.scores_csv === 'BYE') ?? false;

        // Build match number map: Winners first (non-BYE), then Losers, then GF
        const numMap = new Map<string, number>();
        const wMatchNumMap = new Map<string, number>();

        matches.forEach(m => {
            if (m.scores_csv?.includes('BYE')) return;
            const order = m.suggested_play_order;
            if (order !== undefined && order !== null && order < 9000) {
                numMap.set(m.id, order);
                if (m.round > 0 && !m.is_grand_final) {
                    wMatchNumMap.set(m.id, order);
                }
            }
        });

        // Losers bracket: annotate each match with "Loser of X" labels
        // แทนที่ทั้งบล็อก lGroups.forEach
        // Losers bracket: annotate each match with "Loser of X" labels
        lGroups.forEach((group, gi) => {
            const lbRoundNum = gi + 1;
            const isMixing = lbRoundNum % 2 === 0;

            group.forEach((m) => {
                if (m.scores_csv?.includes('BYE')) return;

                const loserOfNums: [number | undefined, number | undefined] = [undefined, undefined];
                const feeds = ws.filter(wm => wm.loser_to_match_id === m.id);

                feeds.forEach((wm) => {
                    const num = wMatchNumMap.get(wm.id);
                    if (num !== undefined) {
                        if (isMixing) {
                            // Mixing: WB loser usually goes to slot 1.
                            // But if a BYE was bypassed, we might receive TWO WB losers.
                            // Or if player1_prereq_match_id is null, slot 0 is empty.
                            if (loserOfNums[1] === undefined && m.player1_prereq_match_id) {
                                loserOfNums[1] = num;
                            } else {
                                if (loserOfNums[0] === undefined) {
                                    loserOfNums[0] = num;
                                } else {
                                    loserOfNums[1] = num;
                                }
                            }
                        } else {
                            if (loserOfNums[0] === undefined) {
                                loserOfNums[0] = num;
                            } else {
                                loserOfNums[1] = num;
                            }
                        }
                    }
                });

                (m as any)._loserOfNums = loserOfNums;
            });
        });

        const winnersRounds = wGroups.map((group, gi) => {
            const isQualify = gi === 0 && r1HasByes;
            const isGF = group.some(m => m.is_grand_final);
            const isReset = group.some(m => m.is_reset_match);
            const label = isGF ? t('bracket.grand_finals' as any) :
                (isReset ? `${t('bracket.grand_finals' as any)} (Reset)` :
                (isQualify ? t('bracket.qualify' as any) : t('admin.matches.round' as any, { n: r1HasByes ? gi : gi + 1 })));
            return { label, matches: group, isQualify };
        }).filter(round => {
            // Filter out rounds with no visible matches
            return round.matches.some(m => {
                const isBye = m.scores_csv?.includes('BYE');
                return !isBye;
            });
        });

        let currentLabelNum = 1;
        const losersRounds = lGroups.map((group) => {
            const hasVisible = group.some(m => {
                const wbFeedersForMatch = matches.filter(wm => wm.loser_to_match_id === m.id);
                const isOnlyOneLBFeeder = wbFeedersForMatch.length === 1 && !m.player1_prereq_match_id && !m.player2_prereq_match_id;
                const isBye = m.scores_csv?.includes('BYE') ||
                    (m.state?.toUpperCase() === 'COMPLETE' && (!m.player1_id || !m.player2_id) && !m.is_grand_final) ||
                    isOnlyOneLBFeeder;
                return !isBye;
            });

            if (!hasVisible) return null;

            return {
                label: `${t('admin.matches.loser_bracket' as any)} R${currentLabelNum++}`,
                matches: group,
                isQualify: false,
            };
        }).filter((r): r is NonNullable<typeof r> => r !== null);
        console.log('=== LB SLOT DEBUG ===');
        lGroups.forEach((group, gi) => {
            console.log(`LB Round ${gi + 1}:`);
            group.forEach(m => {
                const slot = slotMap.get(m.id);
                const order = m.suggested_play_order;
                const p1prereq = m.player1_prereq_match_id?.slice(0, 8);
                const p2prereq = m.player2_prereq_match_id?.slice(0, 8);
                const wbFeeders = matches.filter(wm => wm.loser_to_match_id === m.id)
                    .map(wm => `WB#${wm.suggested_play_order}(slot${slotMap.get(wm.id)})`);
                console.log(`  Match#${order} slot=${slot} p1prereq=${p1prereq} p2prereq=${p2prereq} wbFeeders=[${wbFeeders}]`);
            });
        });

        // Create Y map for PERFECT spatial formatting without line overlaps
        const yMap = new Map<string, number>();

        // WB Y coordinates (Pure geometric strict binary tree)
        wGroups.forEach((group, ri) => {
            group.forEach(m => {
                if (m.is_reset_match) {
                    // Reset match always aligns vertically with the Grand Final match!
                    const gfMatch = matches.find(xm => xm.is_grand_final);
                    const gfY = gfMatch ? yMap.get(gfMatch.id) : undefined;
                    if (gfY !== undefined) {
                        yMap.set(m.id, gfY);
                        return;
                    }
                }

                const slot = slotMap.get(m.id) ?? 0;
                yMap.set(m.id, cardCenterY(slot, ri, UNIT_BASE));
            });
        });

        // LB Y coordinates
        lGroups.forEach((group, gi) => {
            group.forEach(m => {
                const f1Id = m.player1_prereq_match_id;
                const f2Id = m.player2_prereq_match_id;
                const f1y = f1Id ? yMap.get(f1Id) : undefined;
                const f2y = f2Id ? yMap.get(f2Id) : undefined;

                if (f1y !== undefined && f2y !== undefined) {
                    yMap.set(m.id, (f1y + f2y) / 2);
                } else if (f1y !== undefined) {
                    yMap.set(m.id, f1y);
                } else if (f2y !== undefined) {
                    yMap.set(m.id, f2y);
                } else {
                    const slot = slotMap.get(m.id) ?? 0;
                    // Orphans (e.g. bypassed nodes receiving from WB) are stacked sequentially
                    yMap.set(m.id, cardCenterY(slot, 0, UNIT_BASE));
                }
            });
        });

        console.log("=== CLIENT Y MAP DEBUG ===");
        matches.forEach(m => {
            console.log(`  Match #${m.suggested_play_order} (ID: ${m.id.slice(0, 8)}) -> Y: ${yMap.get(m.id)}, slot: ${slotMap.get(m.id)}`);
        });

        return { winnersRounds, losersRounds, slotMap, UNIT: UNIT_BASE, numMap, yMap };
    }, [matches]);

    const isDoubleElim = losersRounds.length > 0;

    if (!matches.length) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#52525b', fontSize: 14, backgroundColor: '#111113', borderRadius: 12, border: '1px solid #27272a' }}>
                {t('bracket.no_matches' as any)}
            </div>
        );
    }

    return (
        <div style={{
            width: '100%',
            backgroundColor: '#111113', borderRadius: 12, border: '1px solid #27272a',
            fontFamily: 'Inter, -apple-system, sans-serif',
            position: 'relative',
            height: '100%',
            minHeight: '600px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            <style>{`@keyframes bracketSearchPulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } } @keyframes bracketSearchGlow { 0%, 100% { box-shadow: 0 0 0 2px rgba(134, 239, 172, .12), 0 0 10px rgba(134, 239, 172, .18); } 50% { box-shadow: 0 0 0 3px rgba(134, 239, 172, .3), 0 0 26px rgba(134, 239, 172, .58); } }`}</style>
            <div style={{
                position: 'absolute', top: 16, left: 16, zIndex: 100,
                display: 'flex', alignItems: 'center', gap: 8,
                width: 'min(310px, calc(100% - 116px))', padding: '8px 10px',
                background: 'rgba(18, 18, 21, 0.88)', backdropFilter: 'blur(12px)',
                border: searchQuery ? '1px solid rgba(134, 239, 172, .7)' : '1px solid rgba(255, 255, 255, .12)',
                boxShadow: searchQuery ? '0 0 18px rgba(134, 239, 172, .16)' : '0 8px 24px rgba(0, 0, 0, .25)',
                borderRadius: 12, transition: 'border-color 180ms ease, box-shadow 180ms ease',
            }}>
                <Search size={16} color={searchQuery ? '#86efac' : '#a1a1aa'} style={searchQuery ? { animation: 'bracketSearchPulse 2.4s ease-in-out infinite' } : undefined} />
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อผู้เล่น / Search player"
                    aria-label="Search player in bracket"
                    style={{ minWidth: 0, flex: 1, border: 0, outline: 0, color: '#f4f4f5', background: 'transparent', fontSize: 13 }}
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} aria-label="Clear player search" style={{ border: 0, background: 'transparent', color: '#a1a1aa', padding: 2, cursor: 'pointer', display: 'flex' }}>
                        <X size={15} />
                    </button>
                )}
            </div>
            {searchQuery.trim() && searchResults.upper.length > 0 && searchResults.lower.length > 0 && (
                <div style={{ position: 'absolute', top: 66, left: 16, zIndex: 100, display: 'flex', overflow: 'hidden', borderRadius: 10, border: '1px solid rgba(134, 239, 172, .35)', background: 'rgba(18, 18, 21, .9)', backdropFilter: 'blur(12px)' }}>
                    <button
                        onClick={() => setSearchLane('upper')}
                        aria-pressed={activeSearchLane === 'upper'}
                        style={{ border: 0, background: activeSearchLane === 'upper' ? 'rgba(134, 239, 172, .16)' : 'transparent', color: activeSearchLane === 'upper' ? '#bbf7d0' : '#a1a1aa', padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}
                    >
                        <ChevronUp size={14} /> สายบน
                    </button>
                    <button
                        onClick={() => setSearchLane('lower')}
                        aria-pressed={activeSearchLane === 'lower'}
                        style={{ border: 0, borderLeft: '1px solid rgba(134, 239, 172, .22)', background: activeSearchLane === 'lower' ? 'rgba(134, 239, 172, .16)' : 'transparent', color: activeSearchLane === 'lower' ? '#bbf7d0' : '#a1a1aa', padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}
                    >
                        <ChevronDown size={14} /> สายล่าง
                    </button>
                </div>
            )}
            {/* Sticky Zoom Controls Container */}
            <div style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                backgroundColor: 'rgba(28, 28, 30, 0.85)',
                backdropFilter: 'blur(10px)',
                padding: '8px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}>
                {/* Highlighted Mobile Scroll Escape Hatch */}
                <div 
                    style={{
                        height: '28px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        border: '1px dashed rgba(59, 130, 246, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '0 10px',
                        cursor: 'ns-resize',
                        touchAction: 'pan-y',
                        userSelect: 'none'
                    }}
                    onTouchStart={(e) => {
                        e.stopPropagation();
                    }}
                    onTouchMove={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#60a5fa', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ↕ เลื่อนหน้าจอ / SWIPE TO SCROLL PAGE
                    </span>
                </div>

                {/* Zoom Controls Row */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        onClick={() => {
                            const newScale = Math.max(0.15, scale - 0.05);
                            adjustZoom(newScale);
                        }}
                        style={{ padding: 8, borderRadius: 8, border: 'none', backgroundColor: 'transparent', color: '#e4e4e7', cursor: 'pointer', display: 'flex' }}
                        title={t('bracket.zoom_out' as any)}
                    >
                        <ZoomOut size={18} />
                    </button>
                    <div style={{ width: 1, height: 18, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignSelf: 'center' }} />
                    <button
                        onClick={resetToLeftFocus}
                        style={{ fontSize: 11, fontWeight: 700, borderRadius: 8, border: 'none', backgroundColor: 'transparent', color: '#a1a1aa', cursor: 'pointer', padding: '0 4px' }}
                    >
                        {Math.round(scale * 100)}%
                    </button>
                    <div style={{ width: 1, height: 18, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignSelf: 'center' }} />
                    <button
                        onClick={() => {
                            const newScale = Math.min(2.0, scale + 0.05);
                            adjustZoom(newScale);
                        }}
                        style={{ padding: 8, borderRadius: 8, border: 'none', backgroundColor: 'transparent', color: '#e4e4e7', cursor: 'pointer', display: 'flex' }}
                        title={t('bracket.zoom_in' as any)}
                    >
                        <ZoomIn size={18} />
                    </button>
                    <button
                        onClick={resetToLeftFocus}
                        style={{ padding: 8, borderRadius: 8, border: 'none', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#e4e4e7', cursor: 'pointer', display: 'flex', marginLeft: 4 }}
                        title={t('bracket.zoom_reset' as any)}
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Grab-to-drag viewport container */}
            <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    touchAction: 'none'
                }}
            >
                {/* Scalable & Pannable Content Canvas */}
                <div
                    ref={contentRef}
                    style={{
                        display: 'inline-block',
                        position: 'absolute',
                        transform: `translate(${currentPosition.current.x}px, ${currentPosition.current.y}px) scale(${scale})`,
                        transformOrigin: 'top left',
                        textAlign: 'left',
                        minWidth: 'max-content',
                        padding: '40px',
                        willChange: 'transform',
                        transition: isDragging || isPinching ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                >
                    {winnersRounds.length > 0 && (
                        <div style={{ marginBottom: isDoubleElim ? 80 : 0 }}>
                            {isDoubleElim && <SectionDivider>{t('admin.matches.winner_bracket' as any)}</SectionDivider>}
                            <BracketSection rounds={winnersRounds} onReportWin={onReportWin} slotMap={slotMap} UNIT={UNIT} numMap={numMap} allMatches={matches} yMap={yMap} t={t} searchQuery={searchQuery} activeMatchId={activeMatchId} badgesByName={badgesByName} onShowBadgeHistory={(name, badges) => setSelectedBadgeHistory({ name, badges })} />
                        </div>
                    )}

                    {losersRounds.length > 0 && (
                        <div>
                            <SectionDivider>{t('admin.matches.loser_bracket' as any)}</SectionDivider>
                            <BracketSection rounds={losersRounds} onReportWin={onReportWin} slotMap={slotMap} UNIT={UNIT} numMap={numMap} allMatches={matches} yMap={yMap} t={t} searchQuery={searchQuery} activeMatchId={activeMatchId} badgesByName={badgesByName} onShowBadgeHistory={(name, badges) => setSelectedBadgeHistory({ name, badges })} />
                        </div>
                    )}
                </div>
            </div>
            <Modal
                isOpen={Boolean(selectedBadgeHistory)}
                onClose={() => setSelectedBadgeHistory(null)}
                title={`${t('bracket.badge_history' as any)} — ${selectedBadgeHistory?.name || ''}`}
                type="custom"
                compact
            >
                <div data-badge-history-modal style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 'min(70dvh, 540px)', overflowY: 'auto', paddingRight: 1 }}>
                    {sortBadgeHistory(selectedBadgeHistory?.badges.history).map((entry, index) => {
                        const periodCode = entry.type === 'monthly' ? 'M' : entry.type === 'yearly' ? 'Y' : 'W';
                        const now = new Date();
                        const currentMonth = now.toISOString().slice(0, 7);
                        const currentYear = String(now.getUTCFullYear());
                        const isCurrent = entry.type === 'yearly'
                            ? entry.period === currentYear
                            : entry.period === currentMonth;
                        const typeLabel = entry.type === 'monthly'
                            ? t('rankings.monthly' as any)
                            : entry.type === 'yearly'
                                ? t('rankings.yearly' as any)
                                : t('rankings.winrate' as any);
                        return <div
                            key={`${entry.type}-${entry.period}-${index}`}
                            data-badge-history-entry={`${entry.type}:${entry.period}:${entry.rank}`}
                            style={{ display: 'flex', gap: 9, alignItems: 'center', padding: 9, borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.035)' }}
                        >
                            <BadgeImage rank={entry.rank} period={periodCode} size={38} muted={!isCurrent} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                                    <strong style={{ color: '#f4f4f5', fontSize: 12 }}>{typeLabel} · {t('bracket.badge_rank' as any)} {entry.rank}</strong>
                                    <span style={{ color: '#a1a1aa', fontSize: 10, whiteSpace: 'nowrap' }}>{formatBadgePeriod(entry, lang)}</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: 4, color: '#d4d4d8', fontSize: 10 }}>
                                    {entry.winRate !== undefined && <span>{t('rankings.winrate' as any)} <strong style={{ color: '#86efac' }}>{entry.winRate.toFixed(2)}%</strong></span>}
                                    {entry.points !== undefined && <span>{t('rankings.points' as any)} <strong>{entry.points}</strong></span>}
                                    {entry.championships !== undefined && <span>{t('rankings.championships' as any)} <strong>{entry.championships}</strong></span>}
                                    {entry.topFour !== undefined && <span>{t('rankings.top4_total' as any)} <strong>{entry.topFour}</strong></span>}
                                    <span>{t('rankings.wins' as any)} <strong>{entry.wins}</strong></span>
                                    <span>{t('rankings.matches' as any)} <strong>{entry.matches}</strong></span>
                                </div>
                            </div>
                        </div>;
                    })}
                </div>
            </Modal>
        </div>
    );
}


function SectionDivider({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: '#27272a' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#a1a1aa', letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{children}</span>
            <div style={{ flex: 1, height: 1, backgroundColor: '#27272a' }} />
        </div>
    );
}

export default React.memo(InternalBracket);
