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
 const dir=await mkdtemp(join(tmpdir(),'turkey-net-'));const runtime=await createRuntime({dataDir:dir});const addr=await runtime.listen(0,'127.0.0.1');const url=`ws://127.0.0.1:${addr.port}`;
 const peers=[];t.after(async()=>{peers.forEach(p=>p.ws.close());await runtime.close();await rm(dir,{recursive:true,force:true});});
 const make=async(role,color)=>{const p=await peer(url,role,color);peers.push(p);return p;};return {runtime,make,url};
}
test('real WebSockets: red/green credit, duplicate delivery, TV state, reconnect, reset, role enforcement',async t=>{
 const {runtime,make}=await fixture(t);const tv=await make('gallery');const green=await make('station','green');const red=await make('station','red');
 await green.call('name',{name:'Grace'});await red.call('name',{name:'Rowan'});
 assert.equal((await tv.call('control',{action:'start',mode:'simultaneous'})).ok,true);
 const started=(await tv.next('state',p=>p.state.phase==='playing')).state;
 const shot=(eventId,props={})=>({roundId:started.roundId,payload:'TKY4',spawnId:started.targets[1].spawnId,eventId,...props});
 const g=shot('green-event-0001');assert.equal((await green.call('scan',g)).accepted,true);
 const first=await tv.next('state',p=>p.hit?.eventId===g.eventId);assert.equal(first.state.targets[1].hp,3);assert.equal(first.state.players.green.score,25);
 assert.equal((await green.call('scan',g)).duplicate,true);assert.equal(runtime.game.targets[1].hp,3);
 assert.equal((await red.call('scan',shot('red-event-0001'))).accepted,true);
 const second=await tv.next('state',p=>p.hit?.eventId==='red-event-0001');assert.equal(second.state.targets[1].hp,2);assert.equal(second.state.players.red.score,25);
 // Two real sockets deliver at once; synchronous authority prevents a lost update.
 await Promise.all([green.call('scan',shot('green-event-0002')),red.call('scan',shot('red-event-0002'))]);
 assert.equal(runtime.game.targets[1].hp,0);assert.equal(runtime.game.players.red.score,50);assert.equal(runtime.game.players.green.score,50);
 green.ws.close();const reconnected=await make('station','green');const recovered=(await reconnected.next('state')).state;assert.equal(recovered.targets[1].hp,0);assert.equal(recovered.players.green.score,50);
 assert.equal((await reconnected.call('scan',g)).duplicate,true);
 assert.match((await red.call('control',{action:'reset'})).error,/gallery/);
 assert.equal((await tv.call('scan',g)).accepted,false);
 await tv.call('control',{action:'finish'});await runtime.scores.pending;
 assert.equal(runtime.scores.board().length,2);
 await tv.call('control',{action:'reset'});assert.equal(runtime.game.phase,'lobby');assert.equal(runtime.game.players.green.score,0);
 assert.equal((await red.call('scan',shot('old-round-event'))).reason,'Old round ignored.');
});
test('software frame diagnostics are correlated without trusting clocks from other machines',async t=>{
 const {make}=await fixture(t);const tv=await make('gallery');const green=await make('station','green');
 await green.call('name',{name:'Solo'});await tv.call('control',{action:'start',mode:'single',singleColor:'green'});
 const s=(await tv.next('state',p=>p.state.phase==='playing')).state;
 await green.call('scan',{roundId:s.roundId,payload:'TKY4',spawnId:s.targets[1].spawnId,eventId:'diagnostic-hit'});
 const {hit}=await tv.next('state',p=>p.hit?.eventId==='diagnostic-hit');
 assert.ok(hit.serverProcessMs>=0);tv.ws.send(JSON.stringify({event:'display:frame',data:{traceId:hit.traceId,domMs:1,frameWaitMs:5}}));
 const metric=await tv.next('diagnostic');assert.equal(metric.domMs,1);assert.ok(metric.serverToFrameReturnMs>=0);
});
test('slow score persistence does not enter the scan or broadcast path',async t=>{
 const {runtime,make}=await fixture(t);let calls=0;let release;
 runtime.scores.write=()=>{calls++;return new Promise(resolve=>{release=resolve;});};
 const tv=await make('gallery');const green=await make('station','green');await green.call('name',{name:'Solo'});await tv.call('control',{action:'start',mode:'single'});
 const s=(await tv.next('state',p=>p.state.phase==='playing')).state;
 assert.equal((await green.call('scan',{roundId:s.roundId,payload:'BEAR',spawnId:s.targets[2].spawnId,eventId:'slow-store-hit'})).accepted,true);
 const packet=await tv.next('state',p=>p.hit?.eventId==='slow-store-hit');assert.equal(packet.state.targets[2].hp,5);assert.equal(calls,0);
 // Avoid intercepting finish writes: the assertion above is about the active-hit path.
 runtime.scores.write=(...args)=>import('node:fs/promises').then(fs=>fs.writeFile(...args));
});
test('a new TV gets the latest authoritative state and the HTTP server exposes only public files',async t=>{
 const {runtime,make,url}=await fixture(t);const tv=await make('gallery');const green=await make('station','green');
 await green.call('name',{name:'Player'});await tv.call('control',{action:'start',mode:'single'});
 const s=runtime.game.snapshot();await green.call('scan',{roundId:s.roundId,spawnId:s.targets[2].spawnId,payload:'BEAR',eventId:'new-tv-hit'});
 const tv2=await make('gallery');const joined=(await tv2.next('state')).state;assert.equal(joined.targets[2].hp,5);assert.equal(joined.players.green.score,40);
 const base=url.replace('ws:','http:');for(const path of ['/gallery','/scan/green','/scan/red','/qr/TKY1.svg'])assert.equal((await fetch(base+path)).status,200);
 assert.equal((await fetch(base+'/data/scores.json')).status,404);assert.equal((await fetch(base+'/server.mjs')).status,404);
 assert.equal((await fetch(base+'/gallery',{method:'POST'})).status,405);
});
