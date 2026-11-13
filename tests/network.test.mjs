import test from 'node:test';import assert from 'node:assert/strict';import { once } from 'node:events';
import { mkdtemp,rm } from 'node:fs/promises';import { tmpdir } from 'node:os';import { join } from 'node:path';
import { createRuntime } from '../server.mjs';
export async function peer(url,role,color) {
 const ws=new WebSocket(`${url}/events?role=${role}${color?'&color='+color:''}`,'oit-turkey-v1');
 const messages=[],waiters=[],acks=new Map();let id=0;
 ws.addEventListener('message',event=>{const p=JSON.parse(event.data);if(p.ack!==undefined){acks.get(p.ack)?.(p.data);acks.delete(p.ack);return;}messages.push(p);for(const wake of [...waiters])wake();});
 await once(ws,'open');
 const next=(event,predicate=()=>true)=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{waiters.splice(waiters.indexOf(find),1);reject(Error(`Timed out: ${event}`));},3000);
   const find=()=>{const i=messages.findIndex(m=>m.event===event&&predicate(m.data));if(i<0)return;clearTimeout(timer);const w=waiters.indexOf(find);if(w>=0)waiters.splice(w,1);resolve(messages.splice(i,1)[0].data);};waiters.push(find);find();
 });
 return {ws,messages,next,call:(event,data)=>new Promise((resolve,reject)=>{const seq=++id;const timer=setTimeout(()=>{acks.delete(seq);reject(Error('Ack timeout'));},3000);acks.set(seq,r=>{clearTimeout(timer);resolve(r);});ws.send(JSON.stringify({id:seq,event,data}));})};
}
async function fixture(t) {
 let now=100000;let seed=7;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const dir=await mkdtemp(join(tmpdir(),'turkey-net-'));const runtime=await createRuntime({dataDir:dir,clock:()=>now,random});const addr=await runtime.listen(0,'127.0.0.1');const url=`ws://127.0.0.1:${addr.port}`;
 const peers=[];t.after(async()=>{peers.forEach(p=>p.ws.close());await runtime.close();await rm(dir,{recursive:true,force:true});});
 const make=async(role,color)=>{const p=await peer(url,role,color);peers.push(p);return p;};
 const move=async value=>{now=value;await new Promise(resolve=>setTimeout(resolve,75));};
 const reveal=async(code)=>{
  if(runtime.game.encounter.clearedAt!==null||now>=runtime.game.encounter.concealAt)await move(runtime.game.encounter.nextAt);
  for(let i=0;code&&runtime.game.encounter.code!==code;i++){assert.ok(i<16&&runtime.game.phase==='playing');await move(runtime.game.encounter.nextAt);}
  await move(Math.max(now,runtime.game.encounter.revealAt));return runtime.game.snapshot();
 };
 let seq=0;const shot=(code=runtime.game.encounter.code)=>({roundId:runtime.game.roundId,payload:code,spawnId:runtime.game.targets.find(t=>t.code===code)?.spawnId,eventId:`network-event-${++seq}`});
 return{runtime,make,url,reveal,move,shot};
}
test('real WebSockets: one winner, duplicate delivery, authoritative TV, reconnect, and reset',async t=>{
 const {runtime,make,reveal,shot}=await fixture(t);const tv=await make('gallery'),g=await make('station','green'),r=await make('station','red');
 await g.call('name',{name:'Grace'});await r.call('name',{name:'Rowan'});await tv.call('control',{action:'start',mode:'simultaneous'});await reveal();
 const data=shot();const hits=await Promise.all([g.call('scan',data),r.call('scan',shot())]);assert.equal(hits.filter(h=>h.accepted).length,1);
 const winner=hits[0].accepted?g:r,result=hits.find(h=>h.accepted),packet=await tv.next('state',p=>p.hit?.eventId===result.eventId);
 assert.equal(packet.hit.killed,true);assert.equal(packet.state.targets.filter(t=>t.active).length,0);assert.equal(Object.values(runtime.game.players).reduce((n,p)=>n+p.score,0),10);
 if(winner===g){assert.equal((await g.call('scan',data)).duplicate,true);g.ws.close();const reconnect=await make('station','green');const state=(await reconnect.next('state')).state;assert.equal(state.players.green.score,10);assert.equal((await reconnect.call('scan',data)).duplicate,true);}
 assert.match((await r.call('control',{action:'reset'})).error,/gallery/);assert.equal((await tv.call('scan',data)).accepted,false);
 await tv.call('control',{action:'finish'});await runtime.scores.pending;assert.equal(runtime.scores.board().length,2);await tv.call('control',{action:'reset'});assert.equal(runtime.game.players.green.streak,0);assert.equal(runtime.game.players.red.mistakes,0);
 assert.equal((await r.call('scan',data)).reason,'Old round ignored.');
});
test('wildlife penalties publish immediately, stay one per color, and leave the code active',async t=>{
 const {runtime,make,reveal,shot}=await fixture(t);const tv=await make('gallery'),g=await make('station','green'),r=await make('station','red');
 await g.call('name',{name:'G'});await r.call('name',{name:'R'});await tv.call('control',{action:'start',mode:'simultaneous'});
 await reveal('TKY4');await g.call('scan',shot());await reveal('DEER');const data=shot();const penalty=await g.call('scan',data);
 assert.equal(penalty.kind,'penalty');assert.equal(penalty.points,-25);const packet=await tv.next('state',p=>p.hit?.eventId===data.eventId);
 assert.equal(packet.state.players.green.score,5);assert.equal(packet.state.players.green.streak,0);assert.equal(packet.state.targets.find(t=>t.code==='DEER').active,true);
 assert.equal((await g.call('scan',data)).duplicate,true);assert.equal((await g.call('scan',shot())).accepted,false);assert.equal(runtime.game.players.green.score,5);
 assert.equal((await r.call('scan',shot())).points,0);assert.equal(runtime.game.players.red.mistakes,1);
});
test('frame diagnostics retain the immediate hit path and do not wait for score persistence',async t=>{
 const {runtime,make,reveal,shot}=await fixture(t);let writes=0;const original=runtime.scores.write;runtime.scores.write=(...args)=>{writes++;return original(...args);};
 const tv=await make('gallery'),g=await make('station','green');await g.call('name',{name:'Solo'});await tv.call('control',{action:'start',mode:'single'});await reveal();
 const data=shot();assert.equal((await g.call('scan',data)).accepted,true);const {hit}=await tv.next('state',p=>p.hit?.eventId===data.eventId);assert.equal(writes,0);
 tv.ws.send(JSON.stringify({event:'display:frame',data:{traceId:hit.traceId,domMs:1,frameWaitMs:5}}));const metric=await tv.next('diagnostic');assert.equal(metric.domMs,1);assert.ok(metric.serverToFrameReturnMs>=0);
 await reveal('BEAR');await g.call('scan',shot());assert.equal(writes,0);
});
test('a second TV receives the same rule and wildlife state; HTTP exposes the new QR only as a public asset',async t=>{
 const {runtime,make,reveal,shot,url}=await fixture(t);const tv=await make('gallery'),g=await make('station','green');await g.call('name',{name:'Solo'});await tv.call('control',{action:'start',mode:'single'});await reveal();await g.call('scan',shot());await reveal('DEER');
 const tv2=await make('gallery');const s=(await tv2.next('state')).state;assert.equal(s.players.green.score,10);assert.equal(s.encounter.code,'DEER');assert.equal(s.targets.find(t=>t.code==='DEER').action,'avoid');
 const base=url.replace('ws:','http:');for(const path of ['/gallery','/scan/green','/scan/red','/qr/DEER.svg'])assert.equal((await fetch(base+path)).status,200);
 assert.equal((await fetch(base+'/data/scores.json')).status,404);assert.equal((await fetch(base+'/server.mjs')).status,404);assert.equal((await fetch(base+'/gallery',{method:'POST'})).status,405);
});
