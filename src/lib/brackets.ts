import { v4 as uuidv4 } from 'uuid';

export type BracketType = 'SINGLE' | 'DOUBLE';

export interface BracketParticipant {
    id: string;
    name: string;
}

export interface InternalMatch {
    id: string;
    tournament_id: string;
    player1_id: string | null;
    player2_id: string | null;
    winner_id: string | null;
    player1_prereq_match_id: string | null;
    player2_prereq_match_id: string | null;
    round: number;
    state: 'PENDING' | 'OPEN' | 'COMPLETE';
    scores_csv: string;
    is_grand_final?: boolean;
    loser_to_match_id?: string | null;
    is_reset_match?: boolean;
    suggested_play_order?: number;
    player1_loser_feeder_id?: string | null;
    player2_loser_feeder_id?: string | null;
    /** @internal tagged during generation, persisted to DB for LB builder identification */
    is_seeding_bye?: boolean;
}

function getStandardSeedOrder(size: number): number[] {
    let seeds = [1];
    while (seeds.length < size) {
        const next: number[] = [];
        for (let i = 0; i < seeds.length; i++) {
            next.push(seeds[i]);
            next.push(seeds.length * 2 + 1 - seeds[i]);
        }
        seeds = next;
    }
    return seeds;
}

function buildWinnersBracket(
    tournamentId: string,
    participants: BracketParticipant[]
): InternalMatch[] {
    const n = participants.length;
    const numRounds = Math.ceil(Math.log2(n));
    const bracketSize = Math.pow(2, numRounds);
    const numR1Slots = bracketSize / 2;
    const matches: InternalMatch[] = [];

    const r1: InternalMatch[] = [];
    for (let i = 0; i < numR1Slots; i++) {
        const m: InternalMatch = {
            id: uuidv4(), tournament_id: tournamentId,
            player1_id: null, player2_id: null, winner_id: null,
            player1_prereq_match_id: null, player2_prereq_match_id: null,
            round: 1, state: 'PENDING', scores_csv: '',
        };
        r1.push(m);
        matches.push(m);
    }
    let prevRound = r1;
    for (let r = 2; r <= numRounds; r++) {
        const cnt = prevRound.length / 2;
        const cur: InternalMatch[] = [];
        for (let i = 0; i < cnt; i++) {
            const m: InternalMatch = {
                id: uuidv4(), tournament_id: tournamentId,
                player1_id: null, player2_id: null, winner_id: null,
                player1_prereq_match_id: prevRound[i * 2].id,
                player2_prereq_match_id: prevRound[i * 2 + 1].id,
                round: r, state: 'PENDING', scores_csv: '',
            };
            cur.push(m);
            matches.push(m);
        }
        prevRound = cur;
    }

    const seedOrder = getStandardSeedOrder(bracketSize);
    const byMap = new Map<number, BracketParticipant>(participants.map((p, i) => [i + 1, p]));

    for (let i = 0; i < numR1Slots; i++) {
        const sA = seedOrder[i * 2];
        const sB = seedOrder[i * 2 + 1];
        const pA = byMap.get(sA);
        const pB = byMap.get(sB);
        const m = r1[i];
        const isByeA = !pA;
        const isByeB = !pB;
        m.is_seeding_bye = isByeA || isByeB;
        if (m.is_seeding_bye) {
            const realPlayer = isByeA ? pB : pA;
            m.player1_id = realPlayer?.id ?? null;
            m.player2_id = null;
            m.state = 'COMPLETE';
            m.winner_id = realPlayer?.id ?? null;
            m.scores_csv = 'BYE';
        } else {
            m.player1_id = pA?.id ?? null;
            m.player2_id = pB?.id ?? null;
            m.state = 'OPEN';
        }
    }
    return matches;
}

export function generateSingleElimination(
    tournamentId: string,
    participants: BracketParticipant[]
): InternalMatch[] {
    const n = participants.length;
    if (n < 2) return [];
    const matches = buildWinnersBracket(tournamentId, participants);
    propagateWinners(matches);

    const sortMatchesForOrder = (list: InternalMatch[]) => {
        return [...list].sort((a, b) => {
            const aBye = a.scores_csv?.includes('BYE') ? 1 : 0;
            const bBye = b.scores_csv?.includes('BYE') ? 1 : 0;
            if (aBye !== bBye) return aBye - bBye;

            const aReady = (a.player1_id !== null && a.player2_id !== null) ? 0 : 1;
            const bReady = (b.player1_id !== null && b.player2_id !== null) ? 0 : 1;
            if (aReady !== bReady) return aReady - bReady;

            return 0;
        });
    };

    let playOrderCtr = 1, byeCtr = 9999;
    sortMatchesForOrder(matches).forEach(m => {
        m.suggested_play_order = m.scores_csv?.includes('BYE') ? byeCtr++ : playOrderCtr++;
    });
    return matches;
}

export function generateDoubleElimination(
    tournamentId: string,
    participants: BracketParticipant[]
): InternalMatch[] {
    const numParticipants = participants.length;
    if (numParticipants < 2) return [];
    const nWR = Math.ceil(Math.log2(numParticipants));

    // ── 1. Build WB ───────────────────────────────────────────────────────────
    const wm = buildWinnersBracket(tournamentId, participants);
    const wbr = new Map<number, InternalMatch[]>();
    wm.forEach(m => {
        const arr = wbr.get(m.round) || [];
        arr.push(m);
        wbr.set(m.round, arr);
    });

    // ── 2. Build LB structure (full bracket — like Challonge) ────────────────
    const lm: InternalMatch[] = [];
    const lbByRound: InternalMatch[][] = [];
    const totalLB = 2 * (nWR - 1);
    const bracketSize = Math.pow(2, nWR);

    const makeLB = (r: number, p1: string | null, p2: string | null): InternalMatch => {
        const m: InternalMatch = {
            id: uuidv4(), tournament_id: tournamentId,
            player1_id: null, player2_id: null, winner_id: null,
            player1_prereq_match_id: p1, player2_prereq_match_id: p2,
            round: -r, state: 'PENDING', scores_csv: '',
        };
        lm.push(m);
        return m;
    };

    // LB R1 — Cross-pair ALL WB R1 matches (full bracket structure)
    {
        const allR1 = wbr.get(1) || [];
        const numLBR1 = allR1.length / 2; // bracketSize / 4
        const slots: InternalMatch[] = [];

        for (let i = 0; i < numLBR1; i++) {
            const m = makeLB(1, null, null);
            // Adjacent crossover: allR1[i*2] vs allR1[i*2+1] (Challonge-style!)
            allR1[i * 2].loser_to_match_id = m.id;
            allR1[i * 2 + 1].loser_to_match_id = m.id;
            m.player1_loser_feeder_id = allR1[i * 2].id;
            m.player2_loser_feeder_id = allR1[i * 2 + 1].id;
            slots.push(m);
        }
        lbByRound.push(slots);
    }

    // LB R2 onward — standard structure
    let wbFeedRound = 2; // WB R1 losers already handled above → start from WB R2
    for (let lr = 2; lr <= totalLB; lr++) {
        const isMixing = lr % 2 === 0;
        const prevLBRound = lbByRound[lr - 2];
        const cur: InternalMatch[] = [];

        if (isMixing) {
            // Mixing: each LB survivor meets one WB loser (1-to-1)
            const wbFeeders = wbr.get(wbFeedRound) || [];
            // Reverse WB feeders for anti-rematch
            const wbReversed = [...wbFeeders].reverse();
            wbFeedRound++;

            for (let i = 0; i < prevLBRound.length; i++) {
                const m = makeLB(lr, prevLBRound[i].id, null);
                if (i < wbReversed.length) {
                    wbReversed[i].loser_to_match_id = m.id;
                    m.player2_loser_feeder_id = wbReversed[i].id;
                }
                cur.push(m);
            }
        } else {
            // Culling: LB survivors pair up
            const numMatches = Math.floor(prevLBRound.length / 2);
            for (let i = 0; i < numMatches; i++) {
                cur.push(makeLB(lr, prevLBRound[i * 2].id, prevLBRound[i * 2 + 1].id));
            }
        }
        lbByRound.push(cur);
    }

    // ── 4. Grand Final + Reset ────────────────────────────────────────────────
    const winnersFinal = wbr.get(nWR)![0];
    const losersFinal = lm[lm.length - 1];

    const grandFinal: InternalMatch = {
        id: uuidv4(), tournament_id: tournamentId,
        player1_id: null, player2_id: null, winner_id: null,
        player1_prereq_match_id: winnersFinal.id,
        player2_prereq_match_id: losersFinal.id,
        round: nWR + 1, state: 'PENDING', scores_csv: '',
        is_grand_final: true,
    };
    const grandFinalReset: InternalMatch = {
        id: uuidv4(), tournament_id: tournamentId,
        player1_id: null, player2_id: null, winner_id: null,
        player1_prereq_match_id: grandFinal.id, player2_prereq_match_id: null,
        round: nWR + 2, state: 'PENDING',
        scores_csv: 'BYE',
        is_reset_match: true,
    };

    // ── 5. Propagate ──────────────────────────────────────────────────────────
    const allMatches = [...wm, ...lm, grandFinal, grandFinalReset];
    propagateWinners(allMatches);

    // ── 6. Phase-interleaved suggested_play_order ─────────────────────────────
    const sortMatchesForOrder = (list: InternalMatch[]) => {
        return [...list].sort((a, b) => {
            const aBye = a.scores_csv?.includes('BYE') ? 1 : 0;
            const bBye = b.scores_csv?.includes('BYE') ? 1 : 0;
            if (aBye !== bBye) return aBye - bBye;

            const aReady = (a.player1_id !== null && a.player2_id !== null) ? 0 : 1;
            const bReady = (b.player1_id !== null && b.player2_id !== null) ? 0 : 1;
            if (aReady !== bReady) return aReady - bReady;

            return 0;
        });
    };

    let playOrderCtr = 1, byeCtr = 9999;
    const assignOrder = (m: InternalMatch) => {
        m.suggested_play_order = m.scores_csv?.includes('BYE') ? byeCtr++ : playOrderCtr++;
    };

    // Phase 1: WB R1
    sortMatchesForOrder(wbr.get(1) || []).forEach(assignOrder);

    // Phase 2 to nWR: Each phase assigns WB R(N), then LB R(2N-3) and LB R(2N-2)
    for (let wbRound = 2; wbRound <= nWR; wbRound++) {
        sortMatchesForOrder(wbr.get(wbRound) || []).forEach(assignOrder);
        
        const lb1 = -(2 * wbRound - 3);
        const lb2 = -(2 * wbRound - 2);

        if (lb1 >= -totalLB) {
            sortMatchesForOrder(lm.filter(m => m.round === lb1)).forEach(assignOrder);
        }
        if (lb2 >= -totalLB) {
            sortMatchesForOrder(lm.filter(m => m.round === lb2)).forEach(assignOrder);
        }
    }
    assignOrder(grandFinal);
    assignOrder(grandFinalReset);

    return allMatches;
}

export function updateMatch(
    matches: InternalMatch[],
    matchId: string,
    scoresCsv: string,
    winnerId: string | null
): InternalMatch[] {
    const match = matches.find(m => m.id === matchId);
    if (!match) return matches;
    match.scores_csv = scoresCsv;
    match.winner_id = winnerId;
    match.state = winnerId ? 'COMPLETE' : 'OPEN';
    if (winnerId) propagateWinners(matches);
    return matches;
}

export function propagateWinners(matches: InternalMatch[]) {
    // ── Preprocessing: Reconstruct loser feeder IDs dynamically ──────────────
    for (const match of matches) {
        const feeders = matches.filter(f => f.loser_to_match_id === match.id);
        if (feeders.length === 2) {
            feeders.sort((a, b) => a.id.localeCompare(b.id));
            match.player1_loser_feeder_id = feeders[0].id;
            match.player2_loser_feeder_id = feeders[1].id;
        } else if (feeders.length === 1) {
            match.player2_loser_feeder_id = feeders[0].id;
            match.player1_loser_feeder_id = null;
        } else {
            match.player1_loser_feeder_id = null;
            match.player2_loser_feeder_id = null;
        }
    }

    let changed = true;
    while (changed) {
        changed = false;

        // ── Phase A: propagate player IDs from all COMPLETE matches ──────────
        for (const match of matches) {
            if ((match.state || 'PENDING').toUpperCase() !== 'COMPLETE') continue;
            
            if (match.winner_id === null) {
                // If a match is complete with a BYE and has no winner, it means both participants were BYEs.
                // Propagate null to children.
                const children = matches.filter(
                    m => m.player1_prereq_match_id === match.id ||
                        m.player2_prereq_match_id === match.id
                );
                for (const child of children) {
                    if (child.is_reset_match) continue;
                    const slot = child.player1_prereq_match_id === match.id
                        ? 'player1_id' : 'player2_id';
                    if (child[slot] !== null) {
                        child[slot] = null;
                        changed = true;
                    }
                }
                continue;
            }

            // Grand Final reset logic
            if (match.is_grand_final) {
                const resetMatch = matches.find(m => m.is_reset_match);
                if (resetMatch) {
                    if (match.winner_id === match.player1_id) {
                        if (resetMatch.state !== 'COMPLETE') {
                            resetMatch.state = 'COMPLETE';
                            resetMatch.scores_csv = 'BYE (Cancelled)';
                            changed = true;
                        }
                    } else {
                        if (resetMatch.state === 'PENDING') {
                            resetMatch.player1_id = match.player1_id;
                            resetMatch.player2_id = match.player2_id;
                            resetMatch.state = 'OPEN';
                            resetMatch.scores_csv = '';
                            changed = true;
                        }
                    }
                }
            }

            // Push winner to children via prereq links
            const children = matches.filter(
                m => m.player1_prereq_match_id === match.id ||
                    m.player2_prereq_match_id === match.id
            );
            for (const child of children) {
                if (child.is_reset_match) continue;
                
                const slot = child.player1_prereq_match_id === match.id
                    ? 'player1_id' : 'player2_id';
                if (child[slot] !== match.winner_id) {
                    child[slot] = match.winner_id;
                    changed = true;
                }
            }

            // Push loser to LB target via loser_to_match_id
            if (!match.is_grand_final && match.loser_to_match_id) {
                const loserId = match.player1_id === match.winner_id
                    ? match.player2_id
                    : match.player1_id;
                const target = matches.find(m => m.id === match.loser_to_match_id);
                if (target) {
                    if (target.player1_id !== loserId && target.player2_id !== loserId) {
                        if (target.player1_id === null && !target.player1_prereq_match_id) {
                            target.player1_id = loserId;
                            changed = true;
                        } else if (target.player2_id === null && !target.player2_prereq_match_id) {
                            target.player2_id = loserId;
                            changed = true;
                        }
                    }
                }
            }
        }

        // ── Phase B: open or BYE pending matches ─────────────────────────────
        for (const match of matches) {
            if ((match.state || 'PENDING').toUpperCase() !== 'PENDING') continue;

            const prereqFeeders = matches.filter(
                m => m.id === match.player1_prereq_match_id ||
                    m.id === match.player2_prereq_match_id
            );
            const loserFeeders = matches.filter(m => m.loser_to_match_id === match.id);
            const allFeeders = [...prereqFeeders, ...loserFeeders];
            const hasFeeders = allFeeders.length > 0;
            const allFeedersComplete = allFeeders.every(
                f => (f.state || '').toUpperCase() === 'COMPLETE'
            );
            const allFeedersPropagated = allFeeders.every(f => {
                if ((f.state || '').toUpperCase() !== 'COMPLETE') return false;
                if (f.winner_id === null) return true; // destined null
                if (f.loser_to_match_id === match.id) {
                    const loserId = f.player1_id === f.winner_id ? f.player2_id : f.player1_id;
                    return match.player1_id === loserId || match.player2_id === loserId;
                }
                return match.player1_id === f.winner_id || match.player2_id === f.winner_id;
            });

            if (hasFeeders && allFeedersComplete && allFeedersPropagated) {
                const p1 = match.player1_id;
                const p2 = match.player2_id;

                if (p1 && p2) {
                    match.state = 'OPEN';
                    changed = true;
                } else if (p1 && p2 === null) {
                    match.winner_id = p1;
                    match.state = 'COMPLETE';
                    match.scores_csv = 'BYE';
                    changed = true;
                } else if (p2 && p1 === null) {
                    match.winner_id = p2;
                    match.state = 'COMPLETE';
                    match.scores_csv = 'BYE';
                    changed = true;
                } else if (p1 === null && p2 === null) {
                    match.winner_id = null;
                    match.state = 'COMPLETE';
                    match.scores_csv = 'BYE';
                    changed = true;
                }
            }
        }

        // ── Phase C: recursive permanent BYE detection ───────────────────────
        const isPrereqDestinedNull = (prereqId: string | null | undefined): boolean => {
            if (!prereqId) return true;
            const pm = matches.find(m => m.id === prereqId);
            if (!pm) return true;
            if ((pm.state || '').toUpperCase() === 'COMPLETE') {
                return pm.winner_id === null;
            }
            const hasPendingLoserP1 = pm.player1_loser_feeder_id ? (matches.find(m => m.id === pm.player1_loser_feeder_id)?.state !== 'COMPLETE') : false;
            const hasPendingLoserP2 = pm.player2_loser_feeder_id ? (matches.find(m => m.id === pm.player2_loser_feeder_id)?.state !== 'COMPLETE') : false;
            
            const p1Null = pm.player1_id === null && !hasPendingLoserP1 && isPrereqDestinedNull(pm.player1_prereq_match_id);
            const p2Null = pm.player2_id === null && !hasPendingLoserP2 && isPrereqDestinedNull(pm.player2_prereq_match_id);
            return p1Null && p2Null;
        };

        for (const match of matches) {
            if (match.is_reset_match) continue;
            if ((match.state || 'PENDING').toUpperCase() === 'COMPLETE') continue;
            if (match.scores_csv?.includes('BYE')) continue;

            const hasPendingLoserP1 = match.player1_loser_feeder_id ? (matches.find(m => m.id === match.player1_loser_feeder_id)?.state !== 'COMPLETE') : false;
            const hasPendingLoserP2 = match.player2_loser_feeder_id ? (matches.find(m => m.id === match.player2_loser_feeder_id)?.state !== 'COMPLETE') : false;

            const p1PermNull = match.player1_id === null && !hasPendingLoserP1 && isPrereqDestinedNull(match.player1_prereq_match_id);
            const p2PermNull = match.player2_id === null && !hasPendingLoserP2 && isPrereqDestinedNull(match.player2_prereq_match_id);

            if (p1PermNull || p2PermNull) {
                match.scores_csv = 'BYE';
                const p1 = match.player1_id;
                const p2 = match.player2_id;
                
                if (p1 && p2 === null) {
                    match.winner_id = p1;
                    match.state = 'COMPLETE';
                } else if (p2 && p1 === null) {
                    match.winner_id = p2;
                    match.state = 'COMPLETE';
                } else if (p1 === null && p2 === null) {
                    if (p1PermNull && p2PermNull) {
                        match.winner_id = null;
                        match.state = 'COMPLETE';
                    }
                }
                changed = true;
            }
        }
    }
}