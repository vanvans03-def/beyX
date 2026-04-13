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
    let playOrderCtr = 1, byeCtr = 9999;
    matches.forEach(m => {
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
            // Cross-pair: top[i] loser vs bottom[mirror] loser
            allR1[i].loser_to_match_id = m.id;
            allR1[allR1.length - 1 - i].loser_to_match_id = m.id;
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

    // ── 5.5 Mark guaranteed auto-advance BYEs in LB ──────────────────────────
    console.log('=== BRACKETS.TS LB DEBUG ===');
    console.log('nWR:', nWR, 'totalLB:', totalLB, 'bracketSize:', bracketSize);
    
    // Log LB structure before BYE pass
    lbByRound.forEach((group, gi) => {
        console.log(`LB R${gi + 1} (round=${-(gi + 1)}): ${group.length} matches`);
        group.forEach((m, i) => {
            const loserFeeders = allMatches.filter(x => x.loser_to_match_id === m.id);
            const loserFeederInfo = loserFeeders.map(lf => 
                `${lf.round > 0 ? 'WB' : 'LB'}R${Math.abs(lf.round)}(bye=${lf.is_seeding_bye}, csv=${lf.scores_csv?.slice(0, 3)})`
            );
            console.log(`  [${i}] id=${m.id.slice(0, 8)} p1prereq=${m.player1_prereq_match_id?.slice(0, 8)} p2prereq=${m.player2_prereq_match_id?.slice(0, 8)} loserFeeders=[${loserFeederInfo}] state=${m.state} csv=${m.scores_csv}`);
        });
    });

    let byePass = true;
    let passNum = 0;
    while (byePass) {
        byePass = false;
        passNum++;
        for (const m of lm) {
            if (m.scores_csv?.includes('BYE')) continue;

            let liveFeeders = 0;
            const details: string[] = [];

            // Check prereq feeders
            for (const pid of [m.player1_prereq_match_id, m.player2_prereq_match_id]) {
                if (!pid) continue;
                const p = allMatches.find(x => x.id === pid);
                if (!p) continue;
                const isDead = p.state === 'COMPLETE' && p.scores_csv?.includes('BYE') && !p.winner_id;
                if (!isDead) {
                    liveFeeders++;
                    details.push(`prereq ${pid.slice(0, 8)} ALIVE (state=${p.state},csv=${p.scores_csv?.slice(0, 3)},winner=${p.winner_id?.slice(0, 8)})`);
                } else {
                    details.push(`prereq ${pid.slice(0, 8)} DEAD`);
                }
            }

            // Check loser feeders
            for (const lf of allMatches.filter(x => x.loser_to_match_id === m.id)) {
                const hasNoLoser = lf.is_seeding_bye ||
                    (lf.scores_csv?.includes('BYE') && (!lf.player1_id || !lf.player2_id));
                if (!hasNoLoser) {
                    liveFeeders++;
                    details.push(`loser ${lf.id.slice(0, 8)} HAS_LOSER (bye=${lf.is_seeding_bye},csv=${lf.scores_csv?.slice(0, 3)})`);
                } else {
                    details.push(`loser ${lf.id.slice(0, 8)} NO_LOSER`);
                }
            }

            if (liveFeeders <= 1) {
                console.log(`  Pass${passNum}: MARKING BYE round=${m.round} id=${m.id.slice(0, 8)} liveFeeders=${liveFeeders} [${details.join(', ')}]`);
                m.scores_csv = 'BYE';
                m.is_seeding_bye = true;
                byePass = true;
            }
        }
    }

    // ── 5.6 Bypass auto-advance BYEs (Prune Graph) ───────────────────────────
    // If a match is a BYE, it's just a passthrough. Downstream matches should
    // point DIRECTLY to the real feeder (WB loser or earlier LB survivor) 
    // so the UI labels and lines render correctly.
    let bypassMutated = true;
    while (bypassMutated) {
        bypassMutated = false;
        lm.forEach(child => {
            const keys = ['player1_prereq_match_id', 'player2_prereq_match_id'] as const;
            keys.forEach(key => {
                const prereqId = child[key];
                if (!prereqId) return;

                const prereq = allMatches.find(x => x.id === prereqId);
                if (prereq && prereq.scores_csv?.includes('BYE')) {
                    // Try to find the real live feeder for this BYE match
                    const wbFeeder = allMatches.find(
                        x => x.loser_to_match_id === prereq.id &&
                            !x.is_seeding_bye &&
                            !(x.state === 'COMPLETE' && x.scores_csv?.includes('BYE') && !x.winner_id)
                    );
                    
                    const lbP1Feeder = prereq.player1_prereq_match_id ? allMatches.find(
                        x => x.id === prereq.player1_prereq_match_id && 
                        !(x.state === 'COMPLETE' && x.scores_csv?.includes('BYE') && !x.winner_id)
                    ) : null;
                    
                    const lbP2Feeder = prereq.player2_prereq_match_id ? allMatches.find(
                        x => x.id === prereq.player2_prereq_match_id && 
                        !(x.state === 'COMPLETE' && x.scores_csv?.includes('BYE') && !x.winner_id)
                    ) : null;

                    if (wbFeeder) {
                        wbFeeder.loser_to_match_id = child.id;
                        child[key] = null;
                        bypassMutated = true;
                    } else if (lbP1Feeder) {
                        child[key] = lbP1Feeder.id;
                        bypassMutated = true;
                    } else if (lbP2Feeder) {
                        child[key] = lbP2Feeder.id;
                        bypassMutated = true;
                    }
                }
            });
        });
    }
    console.log('=== END BRACKETS.TS LB DEBUG ===');

    // ── 6. Phase-interleaved suggested_play_order ─────────────────────────────
    let playOrderCtr = 1, byeCtr = 9999;
    const assignOrder = (m: InternalMatch) => {
        m.suggested_play_order = m.scores_csv?.includes('BYE') ? byeCtr++ : playOrderCtr++;
    };

    // Phase 1: WB R1
    for (const m of (wbr.get(1) || [])) assignOrder(m);

    // Phase 2 to nWR: Each phase assigns WB R(N), then LB R(2N-3) and LB R(2N-2)
    for (let wbRound = 2; wbRound <= nWR; wbRound++) {
        for (const m of (wbr.get(wbRound) || [])) assignOrder(m);
        
        const lb1 = -(2 * wbRound - 3);
        const lb2 = -(2 * wbRound - 2);

        if (lb1 >= -totalLB) {
            lm.filter(m => m.round === lb1).forEach(assignOrder);
        }
        if (lb2 >= -totalLB) {
            lm.filter(m => m.round === lb2).forEach(assignOrder);
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
    let changed = true;
    while (changed) {
        changed = false;

        // ── Phase A: propagate player IDs from all COMPLETE matches ──────────
        for (const match of matches) {
            if ((match.state || 'PENDING').toUpperCase() !== 'COMPLETE') continue;
            if (!match.winner_id) continue;

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
                // Grand Final Reset match is populated specifically by the GF block above.
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
                if (target && loserId) {
                    if (!target.player1_id) {
                        target.player1_id = loserId;
                        changed = true;
                    } else if (!target.player2_id && target.player1_id !== loserId) {
                        target.player2_id = loserId;
                        changed = true;
                    }
                }
            }
        }

        // ── Phase B: open or BYE pending matches ─────────────────────────────
        for (const match of matches) {
            if ((match.state || 'PENDING').toUpperCase() !== 'PENDING') continue;

            if (match.player1_id && match.player2_id) {
                match.state = 'OPEN';
                changed = true;
                continue;
            }

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

            if (hasFeeders && allFeedersComplete) {
                const soloPlayer = match.player1_id || match.player2_id;
                if (soloPlayer && !(match.player1_id && match.player2_id)) {
                    const loserFeedersSentPlayer = loserFeeders.every(f => {
                        const loserId = f.player1_id === f.winner_id ? f.player2_id : f.player1_id;
                        return loserId === match.player1_id || loserId === match.player2_id;
                    });
                    if (loserFeeders.length === 0 || loserFeedersSentPlayer) {
                        match.winner_id = soloPlayer;
                        match.state = 'COMPLETE';
                        match.scores_csv = 'BYE';
                        changed = true;
                    }
                } else if (!match.player1_id && !match.player2_id) {
                    // All feeders complete but no players arrived (both feeders were BYEs)
                    match.state = 'COMPLETE';
                    match.scores_csv = 'BYE';
                    match.winner_id = null;
                    changed = true;
                }
            }
        }
    }
}