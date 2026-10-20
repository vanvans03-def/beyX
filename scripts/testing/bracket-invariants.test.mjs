import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Worker } from 'node:worker_threads';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync(new URL('../../src/lib/brackets.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const workerSource = `
const {parentPort,workerData}=require('node:worker_threads');
const mod={exports:{}};new Function('require','exports','module',workerData.source)(require,mod.exports,mod);
try {
 const {type,count,policy}=workerData;
 const entrants=Array.from({length:count},(_,i)=>({id:String(i+1),name:'Seed '+(i+1)}));
 const matches=(type==='SINGLE'?mod.exports.generateSingleElimination:mod.exports.generateDoubleElimination)('fixture',entrants);
 let played=0,resetPlayed=false; const losses={};
 for(let guard=0;guard<count*3;guard++){
  const open=matches.find(m=>m.state==='OPEN'&&m.player1_id&&m.player2_id);
  if(!open)break;
  let winner=Number(open.player1_id)<Number(open.player2_id)?open.player1_id:open.player2_id;
  if(policy==='upsets')winner=Number(open.player1_id)>Number(open.player2_id)?open.player1_id:open.player2_id;
  if(policy==='reset'&&open.is_grand_final)winner=open.player2_id;
  const loser=winner===open.player1_id?open.player2_id:open.player1_id;
  losses[loser]=(losses[loser]||0)+1;
  open.winner_id=winner;open.state='COMPLETE';open.scores_csv=winner===open.player1_id?'4-1':'1-4';
  mod.exports.propagateWinners(matches);played++;resetPlayed||=!!open.is_reset_match;
 }
 parentPort.postMessage({played,resetPlayed,losses,pending:matches.filter(m=>m.state!=='COMPLETE'&&!m.is_reset_match).length});
}catch(error){parentPort.postMessage({error:error.stack});}
`;

for (const type of ['SINGLE', 'DOUBLE']) for (const count of [2, 3, 4, 5, 6, 7, 8, 9, 12, 16, 17, 32, 33, 64]) for (const policy of type === 'DOUBLE' ? ['favorites', 'upsets', 'reset'] : ['favorites', 'upsets']) {
    test(`${type} ${count} ${policy}: no deadlock, loss limit, match count`, async () => {
        const result = await new Promise((resolve, reject) => {
            const worker = new Worker(workerSource, { eval: true, workerData: { source, type, count, policy } });
            const timeout = setTimeout(() => { void worker.terminate(); reject(new Error('Bracket propagation exceeded 10 seconds')); }, 10_000);
            worker.once('message', result => { clearTimeout(timeout); resolve(result); void worker.terminate(); });
            worker.once('error', error => { clearTimeout(timeout); reject(error); });
        });
        assert.ifError(result.error);
        assert.equal(result.pending, 0, 'All required matches must finish');
        assert.equal(result.played, type === 'SINGLE' ? count - 1 : count * 2 - (result.resetPlayed ? 1 : 2));
        for (const losses of Object.values(result.losses)) assert.ok(losses <= (type === 'SINGLE' ? 1 : 2));
        if (policy === 'reset') assert.equal(result.resetPlayed, true);
    });
}
