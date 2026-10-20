export type Phase = 'idle' | 'countdown' | 'battle' | 'finished';
export type Fighter = { x: number; z: number; vx: number; vz: number; stamina: number; charge: number; angle: number };
export const ARENA_RADIUS = 4.7;
export class BeybladeGame {
    phase: Phase = 'idle';
    fighters: Fighter[] = [];
    selected = 0;
    elapsed = 0;
    quality = -1;
    winner: number | null = null;
    reason: 'spin' | 'over' = 'spin';
    hits = 0;
    skill = 0;
    collisionCooldown = 0;
    target: { x: number; z: number } | null = null;
    keys = new Set<string>();
    constructor() { this.reset(); }
    reset(selected = this.selected) {
        this.selected = selected; this.phase = 'idle'; this.elapsed = 0; this.quality = -1;
        this.winner = null; this.hits = 0; this.skill = 0; this.collisionCooldown = 0;
        this.target = null; this.keys.clear();
        this.fighters = [-1, 1].map(side => ({ x: side * 2, z: 0, vx: 0, vz: 0, stamina: 100, charge: 0, angle: 0 }));
    }
    start() { this.reset(); this.phase = 'countdown'; }
    launch() {
        if (this.phase !== 'countdown' || this.quality >= 0) return;
        this.quality = Math.max(0, 1 - Math.abs(this.elapsed - 3) / 0.65);
    }
    special() {
        const player = this.fighters[this.selected];
        if (this.phase !== 'battle' || player.charge < 100 || this.skill > 0) return false;
        player.charge = 0; this.skill = 1;
        const bot = this.fighters[1 - this.selected];
        const distance = Math.hypot(bot.x - player.x, bot.z - player.z) || 1;
        player.vx = (bot.x - player.x) / distance * 10;
        player.vz = (bot.z - player.z) / distance * 10;
        return true;
    }
    step(dt: number) {
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
        if (length > 0.08 && this.skill <= 0) { p.vx += dx / Math.max(1, length) * 13 * dt; p.vz += dz / Math.max(1, length) * 13 * dt; }
        // The bot pursues with a gentle orbit rather than teleporting to the player.
        const bx = p.x - bot.x + Math.cos(this.elapsed * 2) * 0.8;
        const bz = p.z - bot.z + Math.sin(this.elapsed * 2) * 0.8;
        const bl = Math.hypot(bx, bz) || 1;
        bot.vx += bx / bl * 9 * dt; bot.vz += bz / bl * 9 * dt;
        for (const f of this.fighters) {
            const damping = Math.exp(-1.8 * dt);
            f.vx *= damping; f.vz *= damping;
            f.x += f.vx * dt; f.z += f.vz * dt;
            f.stamina = Math.max(0, f.stamina - (1.6 + Math.hypot(f.vx, f.vz) * 0.035) * dt);
            f.angle += (8 + f.stamina * 0.3) * dt;
            const radius = Math.hypot(f.x, f.z);
            if (radius > ARENA_RADIUS + 0.65) { this.finish(1 - this.fighters.indexOf(f), 'over'); return; }
            if (radius > ARENA_RADIUS && Math.hypot(f.vx, f.vz) < 6) {
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
                const power = this.skill > 0 ? 10 : 3.8;
                p.vx -= nx * 3; p.vz -= nz * 3; bot.vx += nx * power; bot.vz += nz * power;
                p.stamina = Math.max(0, p.stamina - 2.5);
                bot.stamina = Math.max(0, bot.stamina - (this.skill > 0 ? 22 : 3));
                p.charge = Math.min(100, p.charge + 25); this.hits++; this.collisionCooldown = 0.45;
            }
        }
        if (p.stamina <= 0 || bot.stamina <= 0) this.finish(p.stamina === bot.stamina ? null : p.stamina > bot.stamina ? this.selected : 1 - this.selected, 'spin');
    }
    private finish(winner: number | null, reason: 'spin' | 'over') { this.winner = winner; this.reason = reason; this.phase = 'finished'; this.keys.clear(); }
}
