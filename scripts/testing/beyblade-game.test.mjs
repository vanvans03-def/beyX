import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../../src/lib/beyblade-game.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const gameModule = { exports: {} };
new Function('exports', 'module', compiled)(gameModule.exports, gameModule);
const { BeybladeGame, ARENA_RADIUS, DASH_GATES, FINISH_ZONES, finishZoneAt, xtremeRailPoint } = gameModule.exports;
const advance = (game, seconds) => { for (let i = 0; i < Math.round(seconds * 120); i++) game.step(1 / 120); };
const startBattle = (selected = 0, timing = 3) => {
    const game = new BeybladeGame(); game.reset(selected); game.start();
    advance(game, timing); game.launch(); advance(game, 3.81 - timing);
    assert.equal(game.phase, 'battle'); return game;
};

const perfect = startBattle();
const early = startBattle(1, 1);
assert.ok(perfect.quality > 0.99);
assert.ok(perfect.fighters[0].stamina > early.fighters[1].stamina + 50);
const quality = perfect.quality; perfect.launch(); assert.equal(perfect.quality, quality);
const unattended = new BeybladeGame(); unattended.start(); advance(unattended, 3.82);
assert.equal(unattended.phase, 'battle'); assert.equal(unattended.quality, 0);
const steering = startBattle(); const oldX = steering.fighters[0].x;
steering.keys.add('d'); advance(steering, 0.3); assert.ok(steering.fighters[0].x > oldX);
steering.keys.clear(); steering.target = { x: -3, z: -3 }; advance(steering, 0.5);
assert.ok(steering.fighters[0].vz < 0);
const collision = startBattle();
assert.equal(collision.special(), false);
for (let i = 0; i < 4; i++) {
    Object.assign(collision.fighters[0], { x: -0.44, z: 0, vx: 0, vz: 0 });
    Object.assign(collision.fighters[1], { x: 0.44, z: 0, vx: 0, vz: 0 });
    collision.collisionCooldown = 0; collision.step(1 / 120);
}
assert.equal(collision.hits, 4); assert.equal(collision.fighters[0].charge, 100);
assert.equal(collision.special(), true); assert.equal(collision.fighters[0].charge, 0);
assert.equal(collision.special(), false);
const botBefore = collision.fighters[1].stamina;
assert.equal(collision.fighters[0].railMode, 1, 'Special must approach the rail before dealing dash damage');
collision.fighters[0].railMode = 3; collision.fighters[0].railTimer = 0.5;
collision.collisionCooldown = 0;
Object.assign(collision.fighters[0], { x: -0.44, z: 0, vx: 12, vz: 0 });
Object.assign(collision.fighters[1], { x: 0.44, z: 0, vx: 0, vz: 0 }); collision.step(1 / 120);
assert.ok(collision.fighters[1].stamina < botBefore - 20);
assert.ok(collision.fighters.every(f => f.impact > 0), 'Both tops must receive impact feedback');
assert.equal(collision.impact.id, collision.hits);
const rail = startBattle();
Object.assign(rail.fighters[0], { x: ARENA_RADIUS - 0.02, z: 0, vx: 3, vz: 2 });
Object.assign(rail.fighters[1], { x: -2, z: -2 });
rail.step(1 / 120); assert.equal(rail.fighters[0].railMode, 2, 'Normal edge contact engages gears');
const point = xtremeRailPoint(rail.fighters[0].railAngle);
assert.ok(Math.hypot(rail.fighters[0].x - point.x, rail.fighters[0].z - point.z) < 0.001);
for (const selected of [0, 1]) for (const tangent of [-5, 5]) {
    const game = startBattle(selected), fighter = game.fighters[selected];
    Object.assign(fighter, { x: 0, z: -ARENA_RADIUS + 0.02, vx: tangent, vz: -2 });
    game.step(1 / 120);
    assert.equal(fighter.railMode, 2);
    assert.equal(fighter.railDirection, -1, 'Right-spin models cannot engage the rail in reverse');
    const before = fighter.x; advance(game, 0.1);
    assert.ok(fighter.x < before, 'Back rail must carry both tops right-to-left, even against incoming momentum');
}
assert.equal(DASH_GATES.length, 1, 'Stadium has exactly one inward dash point');
for (const gate of DASH_GATES) {
    const point = xtremeRailPoint(gate);
    assert.ok(Math.hypot(point.x, point.z) < ARENA_RADIUS - 0.8, 'Gate must protrude into the stadium');
}
for (const selected of [0, 1]) {
    const dash = startBattle(selected); const player = dash.fighters[selected], bot = dash.fighters[1 - selected];
    Object.assign(player, { x: 1, z: 1, charge: 100, vx: 0, vz: 0 });
    assert.equal(dash.special(), true);
    let rode = false, exited = false;
    for (let i = 0; i < 480; i++) {
        // Keep the opponent off the dash lane: the special must be able to miss.
        Object.assign(bot, { x: -1.7, z: 2, vx: 0, vz: 0, railMode: 0 });
        dash.step(1 / 120);
        rode ||= player.railMode === 2;
        if (player.railMode === 3) { exited = true; break; }
    }
    assert.ok(rode && exited, 'Special must reach gears and leave through a dash gate');
    assert.equal(player.railDirection, -1, 'Special uses the same right-spin rail direction');
    assert.ok(player.vx * player.x + player.vz * player.z < -40, 'Dash must point inward');
    const heading = Math.atan2(player.vz, player.vx), hits = dash.hits;
    Object.assign(bot, { x: 0, z: -2 }); dash.step(1 / 120);
    assert.ok(Math.abs(Math.atan2(player.vz, player.vx) - heading) < 0.001, 'Dash cannot home toward a moved opponent');
    assert.equal(dash.hits, hits, 'Pressing special does not guarantee a hit');
    for (let i = 0; i < 100; i++) {
        Object.assign(bot, { x: -1.7, z: 2, vx: 0, vz: 0, railMode: 0 }); dash.step(1 / 120);
    }
    assert.equal(dash.phase, 'battle', 'An unobstructed special must not throw its user out of the stadium');
}
for (const [index, zone] of FINISH_ZONES.entries()) {
    assert.equal(finishZoneAt(zone.angle), index);
    for (const attackerIndex of [0, 1]) {
        const game = startBattle(), attacker = game.fighters[attackerIndex], victim = game.fighters[1 - attackerIndex];
        const nx = Math.cos(zone.angle), nz = Math.sin(zone.angle);
        Object.assign(attacker, { x: nx * 3.8, z: nz * 3.8, vx: nx * 19, vz: nz * 19, railMode: 3, railTimer: 0.4 });
        Object.assign(victim, { x: nx * 4.6, z: nz * 4.6, vx: 0, vz: 0, railCooldown: 1 });
        game.step(1 / 120); assert.ok(victim.knockout > 0, 'Real dash contact must arm knockback');
        advance(game, 0.15);
        assert.equal(game.phase, 'finishing'); assert.equal(game.reason, zone.reason); assert.equal(game.winner, attackerIndex);
        advance(game, 1.5); assert.equal(game.phase, 'finished'); assert.equal(victim.zone, index); assert.ok(victim.height < -0.4);
    }
    const safe = startBattle();
    Object.assign(safe.fighters[0], { x: Math.cos(zone.angle) * 4.9, z: Math.sin(zone.angle) * 4.9, vx: Math.cos(zone.angle) * 12, vz: Math.sin(zone.angle) * 12, railCooldown: 1 });
    safe.step(1 / 120); assert.equal(safe.phase, 'battle', 'Driving into a pocket without a dash hit cannot lose');
}
const wall = startBattle();
Object.assign(wall.fighters[0], { x: 3.5, z: -3.5, vx: 12, vz: -12, knockout: 1, railCooldown: 1 });
wall.step(1 / 120); assert.equal(wall.phase, 'battle', 'Strong knockback outside a pocket must rebound');
assert.ok(Math.hypot(wall.fighters[0].x, wall.fighters[0].z) <= ARENA_RADIUS + 0.001);
const exhausted = startBattle(1); exhausted.fighters[0].stamina = 0; exhausted.step(1 / 120);
assert.equal(exhausted.winner, 1); assert.equal(exhausted.reason, 'spin');
assert.equal(exhausted.phase, 'finishing'); advance(exhausted, 0.5);
assert.ok(exhausted.fighters[0].fall > 0 && exhausted.fighters[0].fall < 1, 'Losing top visibly tips before the result');
advance(exhausted, 1); assert.equal(exhausted.phase, 'finished'); assert.equal(exhausted.fighters[0].fall, 1);
const stoppedAngle = exhausted.fighters[0].angle; advance(exhausted, 1); assert.equal(exhausted.fighters[0].angle, stoppedAngle, 'Fallen top stops rotating');
const fullRound = startBattle(); advance(fullRound, 70);
assert.equal(fullRound.phase, 'finished');
assert.ok(fullRound.hits > 0, 'Bot must seek and collide with the player');
for (const fighter of fullRound.fighters) for (const value of Object.values(fighter)) assert.ok(Number.isFinite(value));
fullRound.reset(1); assert.equal(fullRound.phase, 'idle'); assert.equal(fullRound.selected, 1);
assert.equal(fullRound.hits, 0); assert.equal(fullRound.skill, 0); assert.equal(fullRound.target, null);
assert.equal(fullRound.fighters[1].stamina, 100);
console.log('PASS: timing, steering, impacts, single dash point, rail/dash and misses, both selections knocking into all 3 pockets, safe non-dash edges, wall rebound, spin topple/stop/result, reset.');
