import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../../src/lib/beyblade-playground-physics.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};new Function('exports','module',compiled)(mod.exports,mod);
const {collidePlaygroundBodies,bounceAtEdges,advancePlaygroundBody,resolvePlaygroundContacts,PLAYGROUND_MAX_SPEED}=mod.exports;
const body=(x,y,vx=0,vy=0,held=false)=>({x,y,vx,vy,held,returnAfter:0});
const a=body(150,150,500,0,true),b=body(200,150);
assert.ok(collidePlaygroundBodies(a,b,1));assert.equal(a.x,150);assert.ok(b.x>=222);assert.ok(b.vx>500);
const left=body(40,150,-500);bounceAtEdges(left,390,844);assert.equal(left.x,44);assert.ok(left.vx>0);
const right=body(350,150,500);bounceAtEdges(right,390,844);assert.equal(right.x,346);assert.ok(right.vx<0);
const top=body(100,40,0,-500);bounceAtEdges(top,390,844);assert.ok(top.vy>0);
const bottom=body(100,810,0,500);bounceAtEdges(bottom,390,844);assert.ok(bottom.vy<0);
const moving=body(340,150,600);for(let i=0;i<12;i++)advancePlaygroundBody(moving,1/120,390,844);assert.ok(moving.x<340);assert.ok(moving.vx<0);
const c=body(100,150,200),d=body(160,150,-200);collidePlaygroundBodies(c,d,0);assert.ok(c.vx<0&&d.vx>0);
const sameA=body(100,100),sameB=body(100,100);collidePlaygroundBodies(sameA,sameB,0);assert.ok(Number.isFinite(sameA.x));assert.ok(Math.hypot(sameA.x-sameB.x,sameA.y-sameB.y)>=72);
const held=body(250,200,1200,0,true),pinned=body(325,200);
for(let i=0;i<500;i++) {
    const before=pinned.x;
    held.x+=4; held.vx=1200;
    bounceAtEdges(held,390,844);resolvePlaygroundContacts(held,pinned,0,390,844);
    assert.ok(held.x<pinned.x,'Rapid wall contact must not swap the tops');
    assert.ok(pinned.x-held.x>=71.99,'Pinned contact must constrain the held top');
    assert.ok(Math.abs(pinned.x-before)<12,'Contact correction must not teleport the pushed top');
    assert.ok(Math.hypot(pinned.vx,pinned.vy)<=PLAYGROUND_MAX_SPEED+0.001,'Repeated held impulses must stay bounded');
    advancePlaygroundBody(pinned,1/120,390,844);
}
console.log('PASS: drag pushes, free collisions, four wall rebounds, momentum, overlap recovery and 500 rapid pinned contacts without swapping/teleporting or unbounded impulses');
