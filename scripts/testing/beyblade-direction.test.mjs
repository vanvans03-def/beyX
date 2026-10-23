import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(fs.readFileSync(new URL('../../src/lib/beyblade-game.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} }; new Function('exports', 'module', compiled)(mod.exports, mod);
const { BeybladeGame, DASH_GATES, xtremeRailPoint, SPIN_DRAIN_PER_SECOND, NORMAL_RAIL_ENTRY_COST } = mod.exports;
const dt = 1 / 120;
function railGame(selected, powered) {
    const game = new BeybladeGame(); game.reset(selected); game.phase = 'battle';
    const player = game.fighters[selected];
    if (powered) { player.charge = 100; assert.equal(game.special(), true); }
    const angle = DASH_GATES[0] + 0.01, point = xtremeRailPoint(angle);
    Object.assign(player, { ...point, railMode: 2, railAngle: angle, railDirection: -1, railTravel: 1 });
    Object.assign(game.fighters[1 - selected], { x: -2, z: 2, vx: 0, vz: 0 });
    return game;
}
for (const selected of [0, 1]) for (const powered of [false, true]) {
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1], [3, 4], [-3, -4]]) {
        const game = railGame(selected, powered), player = game.fighters[selected];
        game.aimDash(x, z); game.step(dt);
        assert.equal(player.railMode, 3);
        const speed = Math.hypot(player.vx, player.vz), length = Math.hypot(x, z);
        assert.ok(Math.abs(player.vx / speed - x / length) < 1e-6);
        assert.ok(Math.abs(player.vz / speed - z / length) < 1e-6);
        assert.equal(game.dashAim, null, 'Direction is consumed at this exit, not reused next time');
        const heading = Math.atan2(player.vz, player.vx);
        game.target = { x: 0, z: 0 }; game.aimDash(-x, -z); game.step(dt);
        assert.ok(Math.abs(Math.atan2(player.vz, player.vx) - heading) < 1e-6, 'Dash does not home or change direction after launch');
    }
    const straight = railGame(selected, powered);
    straight.aimDash(0, 0); straight.aimDash(NaN, Infinity); straight.step(dt);
    assert.ok(Math.abs(straight.fighters[selected].vx) < 1e-6 && straight.fighters[selected].vz > 0, 'No input preserves the original inward straight dash');
    const keyboard = railGame(selected, powered); keyboard.keys.add('ArrowLeft'); keyboard.step(dt);
    assert.ok(keyboard.fighters[selected].vx < -10 && Math.abs(keyboard.fighters[selected].vz) < 1e-6);
    const outward = railGame(selected, powered); outward.aimDash(0, -1);
    for (let i = 0; i < 45; i++) {
        Object.assign(outward.fighters[1 - selected], { x: -2, z: 2, vx: 0, vz: 0 });
        outward.step(dt);
        const player = outward.fighters[selected];
        assert.ok(Math.hypot(player.x, player.z) <= 4.701, 'Outward aimed dash rebounds instead of leaving the stadium');
        assert.equal(outward.phase, 'battle', 'Aimed dash without knockback cannot cause a pocket loss');
    }
}
function endurance(mode, powered = false) {
    const game = new BeybladeGame(); game.phase = 'battle'; game.skill = powered ? 4 : 0;
    const player = game.fighters[0], angle = 0;
    Object.assign(player, mode === 2 ? { ...xtremeRailPoint(angle), railMode: 2, railAngle: angle } : { x: -1, z: 0 });
    Object.assign(game.fighters[1], { x: -2, z: -2 });
    for (let i = 0; i < 60; i++) game.step(dt);
    return player.stamina;
}
assert.ok(SPIN_DRAIN_PER_SECOND <= 0.8, 'Base endurance lasts twice as long without other effort');
assert.ok(endurance(0) > 99, 'Ordinary spin lasts longer');
assert.ok(endurance(2) < endurance(0) - 1.8, 'Normal gear riding has a sustained effort cost');
assert.ok(endurance(2, true) > endurance(2) + 1.8, 'Charged special waives the extra normal-rail effort cost');
const repeated = new BeybladeGame(); repeated.phase = 'battle';
Object.assign(repeated.fighters[1], { x: -2, z: -2 });
for (let i = 0; i < 3; i++) {
    const player = repeated.fighters[0], before = player.stamina;
    Object.assign(player, { x: 4.69, z: 0, vx: 0, vz: 0, railMode: 0, railCooldown: 0 }); repeated.step(dt);
    assert.ok(before - player.stamina >= NORMAL_RAIL_ENTRY_COST, 'Every normal rail entry costs stamina, including repeated entries');
}
repeated.dashAim = { x: 1, z: 0 }; repeated.reset(); assert.equal(repeated.dashAim, null);
console.log('PASS: 24 directional exits across both models/rail modes, keyboard aim, no-input fallback, non-homing, longer endurance, repeated-rail cost, powered exemption and reset.');
