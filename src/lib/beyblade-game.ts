export type Phase = 'idle' | 'countdown' | 'battle' | 'finishing' | 'finished';
// railMode: 0 = free, 1 = approaching rail, 2 = riding gears, 3 = straight dash.
export type Fighter = { x: number; z: number; vx: number; vz: number; stamina: number; charge: number; angle: number; railMode: number; railAngle: number; railDirection: number; railTravel: number; railTimer: number; railCooldown: number; impact: number; knockout: number; fall: number; height: number; zone: number };
export const ARENA_RADIUS = 4.7;
export const DASH_GATES = [-Math.PI / 2];
export const FINISH_ZONES = [
    { angle: Math.PI * 3 / 4, halfWidth: 0.2, reason: 'over' as const, label: 'OVER ZONE', color: 0xffb74d },
    { angle: Math.PI / 4, halfWidth: 0.2, reason: 'over' as const, label: 'OVER ZONE', color: 0xffb74d },
    { angle: Math.PI / 2, halfWidth: 0.18, reason: 'xtreme' as const, label: 'XTREME ZONE', color: 0xff4b82 },
];
export function finishZoneAt(angle: number) {
    return FINISH_ZONES.findIndex(zone => Math.abs(Math.atan2(Math.sin(angle - zone.angle), Math.cos(angle - zone.angle))) < zone.halfWidth);
}
const turn = Math.PI * 2;
const positiveAngle = (angle: number) => (angle % turn + turn) % turn;
// The same inward gear spurs are used by the renderer and the simulation.
export function xtremeRailPoint(angle: number) {
    const nearest = Math.min(...DASH_GATES.map(gate => Math.abs(Math.atan2(Math.sin(angle - gate), Math.cos(angle - gate)))));
    const inset = nearest < 0.2 ? 0.9 * (1 + Math.cos(nearest / 0.2 * Math.PI)) / 2 : 0;
    const radius = ARENA_RADIUS - inset;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}
export class BeybladeGame {
    phase: Phase = 'idle';
    fighters: Fighter[] = [];
    selected = 0;
    elapsed = 0;
    quality = -1;
    winner: number | null = null;
    reason: 'spin' | 'over' | 'xtreme' = 'spin';
    finishTime = 0;
    hits = 0;
    skill = 0;
    collisionCooldown = 0;
    impactId = 0;
    impact: { id: number; x: number; z: number; power: number } | null = null;
    target: { x: number; z: number } | null = null;
    keys = new Set<string>();
    constructor() { this.reset(); }
    reset(selected = this.selected) {
        this.selected = selected; this.phase = 'idle'; this.elapsed = 0; this.quality = -1;
        this.winner = null; this.hits = 0; this.skill = 0; this.collisionCooldown = 0;
        this.impact = null;
        this.finishTime = 0; this.reason = 'spin';
        this.target = null; this.keys.clear();
        this.fighters = [-1, 1].map(side => ({ x: side * 2, z: 0, vx: 0, vz: 0, stamina: 100, charge: 0, angle: 0, railMode: 0, railAngle: 0, railDirection: -1, railTravel: 0, railTimer: 0, railCooldown: 0, impact: 0, knockout: 0, fall: 0, height: 0, zone: -1 }));
    }
    start() { this.reset(); this.phase = 'countdown'; }
    launch() {
        if (this.phase !== 'countdown' || this.quality >= 0) return;
        this.quality = Math.max(0, 1 - Math.abs(this.elapsed - 3) / 0.65);
    }
    special() {
        const player = this.fighters[this.selected];
        if (this.phase !== 'battle' || player.charge < 100 || this.skill > 0 || player.railMode === 3) return false;
        player.charge = 0; this.skill = 4;
        // Head outward, engage the rail, then leave at a fixed gate. Never aim at the bot.
        player.railMode = 1; player.railTimer = 1.5; player.railTravel = 0;
        player.railAngle = Math.hypot(player.x, player.z) > 0.1 ? Math.atan2(player.z, player.x) : player.angle;
        return true;
    }
    step(dt: number) {
        if (this.phase === 'finishing') {
            this.finishTime = Math.min(1.4, this.finishTime + dt);
            for (let i = 0; i < this.fighters.length; i++) {
                const f = this.fighters[i], lost = this.winner === null || i !== this.winner;
                f.impact = Math.max(0, f.impact - dt);
                if (lost) {
                    f.fall = Math.min(1, this.finishTime / 1.1);
                    f.angle += Math.max(0, 1 - this.finishTime / 1.1) ** 2 * 18 * dt;
                    if (f.zone >= 0) {
                        const zone = FINISH_ZONES[f.zone];
                        f.x += (Math.cos(zone.angle) * 5.65 - f.x) * Math.min(1, dt * 6);
                        f.z += (Math.sin(zone.angle) * 5.65 - f.z) * Math.min(1, dt * 6);
                        f.height += (-0.45 - f.height) * Math.min(1, dt * 8);
                    }
                } else f.angle += 12 * dt;
            }
            if (this.finishTime >= 1.4) this.phase = 'finished';
            return;
        }
        if (this.phase === 'countdown') {
            this.elapsed += dt;
            if (this.elapsed >= 3.8) {
                if (this.quality < 0) this.quality = 0;
                const player = this.fighters[this.selected];
                player.stamina = 45 + 55 * this.quality;
                this.fighters[1 - this.selected].stamina = 83;
                this.phase = 'battle'; this.elapsed = 0;
                this.fighters.forEach(f => { f.vx = -f.x * 1.4; f.vz = 1.5; });
            }
            return;
        }
        if (this.phase !== 'battle') return;
        this.elapsed += dt;
        this.skill = Math.max(0, this.skill - dt);
        this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
        const p = this.fighters[this.selected], bot = this.fighters[1 - this.selected];
        let dx = Number(this.keys.has('d') || this.keys.has('ArrowRight')) - Number(this.keys.has('a') || this.keys.has('ArrowLeft'));
        let dz = Number(this.keys.has('s') || this.keys.has('ArrowDown')) - Number(this.keys.has('w') || this.keys.has('ArrowUp'));
        if (dx || dz) this.target = null;
        else if (this.target) { dx = this.target.x - p.x; dz = this.target.z - p.z; }
        const length = Math.hypot(dx, dz);
        if (length > 0.08 && p.railMode === 0 && p.knockout <= 0) { p.vx += dx / Math.max(1, length) * 13 * dt; p.vz += dz / Math.max(1, length) * 13 * dt; }
        // The bot pursues with a gentle orbit rather than teleporting to the player.
        const bx = p.x - bot.x + Math.cos(this.elapsed * 2) * 0.8;
        const bz = p.z - bot.z + Math.sin(this.elapsed * 2) * 0.8;
        const bl = Math.hypot(bx, bz) || 1;
        if (bot.railMode === 0 && bot.knockout <= 0) { bot.vx += bx / bl * 9 * dt; bot.vz += bz / bl * 9 * dt; }
        for (const f of this.fighters) {
            const powered = f === p && this.skill > 0;
            f.impact = Math.max(0, f.impact - dt);
            f.railCooldown = Math.max(0, f.railCooldown - dt);
            f.knockout = Math.max(0, f.knockout - dt);
            f.height = f.knockout > 0 ? Math.sin((1 - f.knockout) * Math.PI) * 0.5 : 0;
            if (f.railMode === 1) {
                const goal = xtremeRailPoint(f.railAngle);
                const distance = Math.hypot(goal.x - f.x, goal.z - f.z);
                f.vx = (goal.x - f.x) / Math.max(distance, 0.01) * 11;
                f.vz = (goal.z - f.z) / Math.max(distance, 0.01) * 11;
                f.railTimer -= dt;
                if (distance < 0.18 || f.railTimer <= 0) this.engageRail(f);
            }
            if (f.railMode === 2) {
                const old = f.railAngle, arc = (powered ? 3.8 : 2.5) * dt;
                f.railAngle += arc * f.railDirection; f.railTravel += arc;
                const point = xtremeRailPoint(f.railAngle);
                f.vx = (point.x - f.x) / dt; f.vz = (point.z - f.z) / dt;
                f.x = point.x; f.z = point.z;
                const gate = DASH_GATES.find(angle => f.railTravel > 0.65 && positiveAngle((angle - old) * f.railDirection) <= arc);
                if (gate !== undefined) {
                    const exit = xtremeRailPoint(gate); f.x = exit.x; f.z = exit.z;
                    f.railMode = 3; f.railTimer = 0.4; f.railCooldown = 1.2;
                    f.vx = -Math.cos(gate) * (powered ? 19 : 12); f.vz = -Math.sin(gate) * (powered ? 19 : 12);
                }
            }
            const damping = Math.exp(-(f.railMode === 3 || f.knockout > 0 ? 0.45 : f.railMode === 1 ? 0 : 1.8) * dt);
            if (f.railMode !== 2) {
                f.vx *= damping; f.vz *= damping;
                f.x += f.vx * dt; f.z += f.vz * dt;
            }
            if (f.railMode === 3) {
                f.railTimer -= dt;
                if (f.railTimer <= 0) { f.railMode = 0; if (f === p) this.skill = 0; }
            }
            f.stamina = Math.max(0, f.stamina - (1.6 + Math.hypot(f.vx, f.vz) * 0.035) * dt);
            f.angle += (8 + f.stamina * 0.3) * dt;
            const radius = Math.hypot(f.x, f.z);
            const zone = finishZoneAt(Math.atan2(f.z, f.x));
            const outwardSpeed = (f.x * f.vx + f.z * f.vz) / Math.max(radius, 0.001);
            if (radius > ARENA_RADIUS + 0.12 && zone >= 0 && f.knockout > 0 && outwardSpeed > 3) {
                f.zone = zone; this.finish(1 - this.fighters.indexOf(f), FINISH_ZONES[zone].reason); return;
            }
            if (f.railMode === 0 && radius >= ARENA_RADIUS - 0.12 && f.railCooldown <= 0 && f.knockout <= 0) this.engageRail(f);
            // Only a strong dash impact opens a pocket. Driving there or missing a dash rebounds.
            if (f.railMode === 0 && radius > ARENA_RADIUS) {
                if (zone >= 0 && f.knockout > 0 && outwardSpeed > 3) continue;
                const nx = f.x / radius, nz = f.z / radius;
                const outward = f.vx * nx + f.vz * nz;
                if (outward > 0) { f.vx -= 1.6 * outward * nx; f.vz -= 1.6 * outward * nz; }
                f.x = nx * ARENA_RADIUS; f.z = nz * ARENA_RADIUS;
            }
        }
        const x = bot.x - p.x, z = bot.z - p.z, distance = Math.hypot(x, z);
        if (distance < 0.92) {
            const nx = distance > 0.001 ? x / distance : 1, nz = distance > 0.001 ? z / distance : 0;
            const overlap = (0.92 - distance) / 2;
            p.x -= nx * overlap; p.z -= nz * overlap; bot.x += nx * overlap; bot.z += nz * overlap;
            if (this.collisionCooldown <= 0) {
                const closing = (p.vx - bot.vx) * nx + (p.vz - bot.vz) * nz;
                const playerDash = p.railMode === 3 && closing > 6;
                const botDash = bot.railMode === 3 && closing > 6;
                const dashHit = playerDash || botDash;
                const power = dashHit ? 10 : 3.8;
                p.vx -= nx * 3; p.vz -= nz * 3; bot.vx += nx * power; bot.vz += nz * power;
                if (dashHit) {
                    const victim = playerDash ? bot : p, sign = playerDash ? 1 : -1;
                    victim.vx += nx * sign * 14; victim.vz += nz * sign * 14;
                    victim.knockout = 1; victim.railMode = 0; victim.railCooldown = 1.2;
                }
                p.stamina = Math.max(0, p.stamina - 2.5);
                bot.stamina = Math.max(0, bot.stamina - (playerDash ? 22 : 3));
                if (botDash) p.stamina = Math.max(0, p.stamina - 19.5);
                p.impact = bot.impact = 0.35;
                this.impact = { id: ++this.impactId, x: (p.x + bot.x) / 2, z: (p.z + bot.z) / 2, power: dashHit ? 1.6 : 1 };
                // An impact knocks riders off the gears; they must reconnect after cooldown.
                for (const f of [p, bot]) if (f.railMode === 2) { f.railMode = 0; f.railCooldown = 0.65; }
                p.charge = Math.min(100, p.charge + 25); this.hits++; this.collisionCooldown = 0.45;
            }
        }
        if (p.stamina <= 0 || bot.stamina <= 0) this.finish(p.stamina === bot.stamina ? null : p.stamina > bot.stamina ? this.selected : 1 - this.selected, 'spin');
    }
    private engageRail(f: Fighter) {
        f.railAngle = Math.atan2(f.z, f.x);
        // Both current models spin right: travel right-to-left along the back rail,
        // regardless of incoming momentum. Add model handedness when left-spin tops exist.
        f.railDirection = -1;
        f.railMode = 2; f.railTravel = 0;
        const point = xtremeRailPoint(f.railAngle); f.x = point.x; f.z = point.z;
    }
    private finish(winner: number | null, reason: 'spin' | 'over' | 'xtreme') {
        this.winner = winner; this.reason = reason; this.phase = 'finishing'; this.finishTime = 0; this.skill = 0; this.keys.clear(); this.target = null;
        this.fighters.forEach(f => { f.railMode = 0; f.vx = f.vz = 0; });
    }
}
