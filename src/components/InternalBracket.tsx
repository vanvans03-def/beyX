"use client";

import React, { useMemo } from 'react';

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
    onMatchClick?: (match: InternalMatch) => void;
    onReportWin?: (match: InternalMatch, winnerId: string, winnerName: string, scores: string) => void;
    provider?: string;
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

// ─── Match Card ───────────────────────────────────────────────────────────────
function MatchCard({ match, onMatchClick, onReportWin, matchNum, loserOfNums }: {
    match: InternalMatch;
    onMatchClick?: (m: InternalMatch) => void;
    onReportWin?: (m: InternalMatch, winnerId: string, winnerName: string, scores: string) => void;
    matchNum?: number;
    loserOfNums?: [number | undefined, number | undefined];
}) {
    const isOpen = match.state?.toUpperCase() === 'OPEN';
    const isComplete = match.state?.toUpperCase() === 'COMPLETE';
    const isBye = match.scores_csv?.includes('BYE');
    const p1 = match.player1?.name;
    const p2 = match.player2?.name;
    const scores = match.scores_csv?.split('-') ?? [];
    const p1Won = isComplete && match.winner_id === match.player1_id && !!match.winner_id;
    const p2Won = isComplete && match.winner_id === match.player2_id && !!match.winner_id;

    if (isBye) return null;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {matchNum !== undefined && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', minWidth: 18, textAlign: 'right', flexShrink: 0 }}>
                    {matchNum}
                </span>
            )}

            <div
                onClick={() => isOpen && onMatchClick?.(match)}
                style={{
                    width: CARD_W, height: CARD_H,
                    display: 'flex', flexDirection: 'column',
                    border: isOpen ? '1px solid #3f3f46' : '1px solid #27272a',
                    borderRadius: 5, overflow: 'hidden',
                    cursor: isOpen ? 'pointer' : 'default',
                    position: 'relative', flexShrink: 0,
                }}
            >
                {isOpen && (
                    <div style={{ position: 'absolute', top: 5, right: 6, width: 5, height: 5, borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
                )}
                {/* P1 */}
                <div
                    onClick={(e) => {
                        if (isOpen && match.player1_id && onReportWin) {
                            e.stopPropagation();
                            onReportWin(match, match.player1_id, p1 || "Player 1", "1-0");
                        }
                    }}
                    style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 10px', borderBottom: '1px solid #27272a',
                        backgroundColor: p1Won ? '#1e2d1e' : '#1c1c1e',
                        cursor: (isOpen && match.player1_id) ? 'pointer' : 'default',
                    }}
                >
                    <span style={{ fontSize: 13, color: p1Won ? '#10b981' : p2Won ? '#71717a' : '#e4e4e7', fontWeight: p1Won ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 144 }}>
                        {p1 ? p1 : <em style={{ color: '#71717a', fontStyle: 'normal', fontSize: 12 }}>{loserOfNums?.[0] !== undefined ? `Loser of #${loserOfNums[0]} round` : (match.player1_prereq_match_id ? '' : 'TBD')}</em>}
                    </span>
                    {isComplete && <span style={{ fontSize: 13, fontWeight: 700, color: p1Won ? '#10b981' : '#71717a', minWidth: 18, textAlign: 'right' }}>{scores[0] ?? 0}</span>}
                </div>
                {/* P2 */}
                <div
                    onClick={(e) => {
                        if (isOpen && match.player2_id && onReportWin) {
                            e.stopPropagation();
                            onReportWin(match, match.player2_id, p2 || "Player 2", "0-1");
                        }
                    }}
                    style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 10px',
                        backgroundColor: p2Won ? '#1e2d1e' : '#1c1c1e',
                        cursor: (isOpen && match.player2_id) ? 'pointer' : 'default',
                    }}
                >
                    <span style={{ fontSize: 13, color: p2Won ? '#10b981' : p1Won ? '#71717a' : '#e4e4e7', fontWeight: p2Won ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 144 }}>
                        {p2 ? p2 : <em style={{ color: '#71717a', fontStyle: 'normal', fontSize: 12 }}>{loserOfNums?.[1] !== undefined ? `Loser of #${loserOfNums[1]} round` : (match.player2_prereq_match_id ? '' : 'TBD')}</em>}
                    </span>
                    {isComplete && <span style={{ fontSize: 13, fontWeight: 700, color: p2Won ? '#10b981' : '#71717a', minWidth: 18, textAlign: 'right' }}>{scores[1] ?? 0}</span>}
                </div>
            </div>
        </div>
    );
}

// ─── Bracket Section with SVG connectors ─────────────────────────────────────
function BracketSection({
    rounds,
    onMatchClick,
    onReportWin,
    slotMap,
    UNIT,
    numMap,
    allMatches,
    yMap
}: {
    rounds: { label: string; matches: InternalMatch[]; isQualify: boolean }[];
    onMatchClick?: (m: InternalMatch) => void;
    onReportWin?: (m: InternalMatch, winnerId: string, winnerName: string, scores: string) => void;
    slotMap: Map<string, number>;
    UNIT: number;
    numMap: Map<string, number>;
    allMatches: InternalMatch[];
    yMap: Map<string, number>;
}) {
    const r1Count = rounds[0]?.matches.length ?? 0;
    const totalH = r1Count * UNIT + 40;

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {rounds.map((round, ri) => {
                const prevRound = ri > 0 ? rounds[ri - 1] : null;

                return (
                    <React.Fragment key={ri}>
                        {prevRound && (
                            <svg width={CONNECTOR_W} height={totalH + 40} style={{ flexShrink: 0, overflow: 'visible', marginTop: 28 }}>
                                {round.matches.map(m => {
                                    const wbFeedersForMatch = allMatches.filter(wm => wm.loser_to_match_id === m.id);
                                    const isOnlyOneLBFeeder = wbFeedersForMatch.length === 1 && !m.player1_prereq_match_id && !m.player2_prereq_match_id;
                                    const isBye = m.scores_csv?.includes('BYE') || isOnlyOneLBFeeder;
                                    if (isBye) return null;

                                    const myY = yMap.get(m.id) ?? 0;
                                    const cx = CONNECTOR_W / 2;
                                    const lines: React.ReactNode[] = [];

                                    // หา feeders จาก prereq links (WB และ LB survivor)
                                    const f1 = prevRound.matches.find(pm => pm.id === m.player1_prereq_match_id);
                                    const f2 = prevRound.matches.find(pm => pm.id === m.player2_prereq_match_id);

                                    // หา feeders จาก loser_to_match_id (WB loser dropping ลง LB)
                                    const loserFeeders = prevRound.matches.filter(pm =>
                                        pm.loser_to_match_id === m.id &&
                                        !pm.scores_csv?.includes('BYE') &&
                                        !(pm.state?.toUpperCase() === 'COMPLETE' && (!pm.player1_id || !pm.player2_id))
                                    );

                                    const f1Hidden = f1 && prevRound.isQualify && f1.scores_csv?.includes('BYE');
                                    const f2Hidden = f2 && prevRound.isQualify && f2.scores_csv?.includes('BYE');

                                    const f1Y = f1 && !f1Hidden ? (yMap.get(f1.id) ?? 0) : null;
                                    const f2Y = f2 && !f2Hidden ? (yMap.get(f2.id) ?? 0) : null;

                                    // loser feeders Y positions
                                    const loserFeederYs = loserFeeders
                                        .map(lf => yMap.get(lf.id))
                                        .filter((y): y is number => y !== undefined);

                                    if (f1Y !== null && f2Y !== null) {
                                        lines.push(<path key="f1" d={`M 0 ${f1Y} H ${cx} V ${myY}`} fill="none" stroke="#3a3a3d" strokeWidth="1.5" strokeLinejoin="round" />);
                                        lines.push(<path key="f2" d={`M 0 ${f2Y} H ${cx} V ${myY}`} fill="none" stroke="#3a3a3d" strokeWidth="1.5" strokeLinejoin="round" />);
                                        lines.push(<path key="mid" d={`M ${cx} ${myY} H ${CONNECTOR_W}`} fill="none" stroke="#3a3a3d" strokeWidth="1.5" />);
                                    } else if (f1Y !== null) {
                                        lines.push(<path key="f1only" d={`M 0 ${f1Y} H ${cx} V ${myY} H ${CONNECTOR_W}`} fill="none" stroke="#3a3a3d" strokeWidth="1.5" strokeLinejoin="round" />);
                                    } else if (f2Y !== null) {
                                        lines.push(<path key="f2only" d={`M 0 ${f2Y} H ${cx} V ${myY} H ${CONNECTOR_W}`} fill="none" stroke="#3a3a3d" strokeWidth="1.5" strokeLinejoin="round" />);
                                    } else if (loserFeederYs.length > 0) {
                                        // LB Culling R1: เส้นจาก WB losers
                                        loserFeederYs.forEach((ly, idx) => {
                                            lines.push(<path key={`lf${idx}`} d={`M 0 ${ly} H ${cx} V ${myY} H ${CONNECTOR_W}`} fill="none" stroke="#3a3a3d" strokeWidth="1.5" strokeLinejoin="round" />);
                                        });
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
                                    const wbFeedersForMatch = allMatches.filter(wm => wm.loser_to_match_id === m.id);
                                    const isOnlyOneLBFeeder = wbFeedersForMatch.length === 1 && !m.player1_prereq_match_id && !m.player2_prereq_match_id;
                                    const isBye = m.scores_csv?.includes('BYE') ||
                                        (m.state?.toUpperCase() === 'COMPLETE' && (!m.player1_id || !m.player2_id) && !m.is_grand_final) ||
                                        isOnlyOneLBFeeder;
                                    if (isBye) return null;

                                    const topY = (yMap.get(m.id) ?? 0) - CARD_H / 2;
                                    const num = numMap.get(m.id);
                                    const loserOfNums = (m as any)._loserOfNums;

                                    return (
                                        <div key={m.id} style={{ position: 'absolute', top: topY, left: 0 }}>
                                            <MatchCard
                                                match={m}
                                                onMatchClick={onMatchClick}
                                                onReportWin={onReportWin}
                                                matchNum={num}
                                                loserOfNums={loserOfNums}
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
const InternalBracket: React.FC<Props> = ({ matches, onMatchClick, onReportWin }) => {
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

                // ถ้าเป็น BYE match ไม่ต้อง set slot (จะซ่อน) แต่ต้อง traverse ต่อ
                if (!m.scores_csv?.includes('BYE')) {
                    slotMap.set(id, slot);
                }

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
                    // LB R1: matches are already in correct spatial order from cross-pairing
                    sortKey = i;
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

        // Re-compact LB slots: remove gaps from hidden BYE matches
        // Visible matches get sequential slots 0, 1, 2, ...
        lGroups.forEach((group) => {
            const visible = group
                .filter(m => !m.scores_csv?.includes('BYE'))
                .sort((a, b) => (slotMap.get(a.id) ?? 0) - (slotMap.get(b.id) ?? 0));
            visible.forEach((m, idx) => {
                slotMap.set(m.id, idx);
            });
        });


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
            const label = isGF ? 'Grand Finals' : (isQualify ? 'Qualify' : `Round ${r1HasByes ? gi : gi + 1}`);
            return { label, matches: group, isQualify };
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
                label: `Losers R${currentLabelNum++}`,
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
                const isBye = m.scores_csv?.includes('BYE');
                if (isBye) return;

                const slot = slotMap.get(m.id) ?? 0;
                yMap.set(m.id, cardCenterY(slot, ri, UNIT_BASE));
            });
        });

        // LB Y coordinates
        lGroups.forEach((group, gi) => {
            group.forEach(m => {
                const isBye = m.scores_csv?.includes('BYE');
                if (isBye) return;

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

        return { winnersRounds, losersRounds, slotMap, UNIT: UNIT_BASE, numMap, yMap };
    }, [matches]);

    const isDoubleElim = losersRounds.length > 0;

    if (!matches.length) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#52525b', fontSize: 14, backgroundColor: '#111113', borderRadius: 12, border: '1px solid #27272a' }}>
                No matches generated yet.
            </div>
        );
    }

    return (
        <div style={{
            width: '100%', overflowX: 'auto', overflowY: 'auto',
            backgroundColor: '#111113', borderRadius: 12, border: '1px solid #27272a',
            padding: '20px 24px',
            fontFamily: 'Inter, -apple-system, sans-serif',
        }}>
            {winnersRounds.length > 0 && (
                <div style={{ marginBottom: isDoubleElim ? 48 : 0 }}>
                    {isDoubleElim && <SectionDivider>Winners Bracket</SectionDivider>}
                    <BracketSection rounds={winnersRounds} onMatchClick={onMatchClick} onReportWin={onReportWin} slotMap={slotMap} UNIT={UNIT} numMap={numMap} allMatches={matches} yMap={yMap} />
                </div>
            )}

            {losersRounds.length > 0 && (
                <div>
                    <SectionDivider>Losers Bracket</SectionDivider>
                    <BracketSection rounds={losersRounds} onMatchClick={onMatchClick} onReportWin={onReportWin} slotMap={slotMap} UNIT={UNIT} numMap={numMap} allMatches={matches} yMap={yMap} />
                </div>
            )}
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

export default InternalBracket;
