import test from 'node:test';import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';import { tmpdir } from 'node:os';import { join } from 'node:path';
import { ScoreStore } from '../lib/scores.mjs';
const round={roundId:'one',mode:'single',endedAt:'2026-11-04T00:00:00Z',players:[{name:'Grace',color:'green',score:100,hits:4,kills:1}]};
test('completed scores survive a store restart, and duplicate save requests do not duplicate rows',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'christmas-store-'));try{const first=await new ScoreStore(dir).init();await first.add(round);await first.add(round);
 const restarted=await new ScoreStore(dir).init();assert.equal(restarted.board().length,1);assert.equal(restarted.board()[0].score,100);}finally{await rm(dir,{recursive:true,force:true});}
});
test('write errors remain visible and a retry saves the retained round',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'christmas-error-'));let fail=true;
 try{const store=await new ScoreStore(dir,{write:(...args)=>fail?Promise.reject(Error('Disk unavailable')):writeFile(...args)}).init();
 await assert.rejects(store.add(round));assert.equal(store.status,'error');assert.equal(store.board().length,1);fail=false;await store.save();assert.equal(store.status,'saved');
 const restarted=await new ScoreStore(dir).init();assert.equal(restarted.board().length,1);}finally{await rm(dir,{recursive:true,force:true});}
});
test('ruleset filtering keeps old records while separating the new scoring leaderboard',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'christmas-rules-'));
 try{
  const store=await new ScoreStore(dir).init();
  await store.add({roundId:'old-rules',mode:'single',endedAt:'2026-11-09',players:[{name:'Old',color:'green',score:900}]});
  await store.add({roundId:'new-rules',ruleset:'christmas-v1',mode:'single',endedAt:'2026-11-13',players:[{name:'New',color:'red',score:30}]});
  assert.equal(store.board().length,2);assert.deepEqual(store.board('christmas-v1').map(p=>p.name),['New']);
  const reloaded=await new ScoreStore(dir).init();assert.equal(reloaded.board().length,2);assert.equal(reloaded.board('christmas-v1').length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

