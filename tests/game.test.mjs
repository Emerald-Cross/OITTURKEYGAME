import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, ROUND_MS, RULESET } from '../lib/game.mjs';
import { ENCOUNTER_BAG, APPROACH_MS, PEEK_MS, DODGE_MS, CLEAR_MS, encounterPhase, encounterPose } from '../public/encounters.js';
import { createScanner } from '../public/scanner.js';
function setup(mode='simultaneous',extra={}) {
 let now=100000,seq=0,seed=42;const rounds=[];
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const game=new Game({clock:()=>now,random,onFinish:r=>rounds.push(r)});
 game.configure({mode,names:{green:'Grace',red:'Rowan'},...extra});game.start();
 const at=value=>{assert.ok(value>=now,'Test clocks move forward');now=value;game.tick();};
 const next=()=>at(game.encounter.nextAt);
 const reveal=(code)=>{
  if(game.encounter.clearedAt!==null||now>=game.encounter.concealAt)next();
  for(let i=0;code&&game.encounter.code!==code;i++){assert.ok(i<16&&game.phase==='playing','Requested animal must appear');next();}
  at(Math.max(now,game.encounter.revealAt));return game.targets.find(t=>t.code===game.encounter.code);
 };
 const shooting=()=>{reveal();while(game.targets.find(t=>t.code===game.encounter.code).action!=='shoot'){next();reveal();}return game.encounter.code;};
 const shot=(code=game.encounter.code,props={})=>({payload:code,roundId:game.roundId,spawnId:game.targets.find(t=>t.code===code)?.spawnId,eventId:`event-${++seq}-test`,...props});
 return{game,rounds,at,next,reveal,shooting,shot};
}
test('one scan clears snowmen and gold presents, and hides its code synchronously',()=>{
 const {game,reveal,shot}=setup();reveal();
 const normal=game.scan('green',shot());assert.equal(normal.accepted,true);assert.equal(normal.killed,true);assert.equal(normal.points,10);assert.equal(game.targets[0].hp,0);assert.equal(game.targets.some(t=>t.active),false);
 reveal('GIFT');const gold=game.scan('red',shot());assert.equal(gold.points,30);assert.equal(gold.killed,true);assert.equal(game.players.red.kills,1);
});
test('a race has one winner; the losing scan is not a mistake',()=>{
 const {game,reveal,shot}=setup();reveal();const g=shot(),r=shot();
 assert.equal(game.scan('green',g).accepted,true);assert.equal(game.scan('red',r).accepted,false);
 assert.equal(game.players.green.score,10);assert.equal(game.players.red.score,0);assert.equal(game.players.red.mistakes,0);assert.equal(game.players.red.streak,0);
});
test('repeating a delivery is idempotent, including after clearing and replacement',()=>{
 const {game,reveal,shot}=setup();reveal();const data=shot();const first=game.scan('green',data);
 assert.equal(game.scan('green',data).duplicate,true);reveal('SNOW');
 assert.equal(game.scan('green',data).duplicate,true);assert.equal(game.players.green.score,first.score);
 assert.equal(game.scan('green',{...data,eventId:'delayed-new-id'}).accepted,false);
 assert.equal(game.scan('green',shot()).accepted,true);assert.equal(game.players.green.score,20);
});
test('clean hits increase the next multiplier at three and six, capped at three',()=>{
 const {game,shooting,shot}=setup();let total=0;
 for(let i=0;i<10;i++){
  shooting();const result=game.scan('green',shot());const expected=Math.min(3,1+Math.floor(i/3));
  assert.equal(result.multiplier,expected);assert.equal(result.points,result.basePoints*expected);total+=result.points;
 }
 assert.equal(game.players.green.score,total);assert.equal(game.players.green.streak,10);assert.equal(game.players.green.bestStreak,10);assert.equal(game.players.green.hits,10);
});
test('scanning Santa or reindeer deducts points and resets only that player’s streak',()=>{
 const {game,shooting,reveal,shot}=setup();
 for(let i=0;i<4;i++){shooting();game.scan('green',shot());}
 const before=game.players.green.score;reveal('DEER');const old=shot();
 const penalty=game.scan('green',old);assert.equal(penalty.accepted,true);assert.equal(penalty.kind,'penalty');assert.equal(penalty.points,-25);assert.equal(penalty.killed,false);
 assert.equal(game.players.green.score,before-25);assert.equal(game.players.green.streak,0);assert.equal(game.players.green.bestStreak,4);assert.equal(game.players.green.mistakes,1);
 assert.equal(game.targets.find(t=>t.code==='DEER').active,true);assert.equal(game.players.red.mistakes,0);
 assert.equal(game.scan('green',old).duplicate,true);assert.equal(game.scan('green',shot()).reason,'Already counted this target.');assert.equal(game.players.green.score,before-25);
 shooting();assert.equal(game.scan('green',shot()).multiplier,1);
});
test('each player can incur one penalty per hold-fire appearance, with a zero score floor',()=>{
 const {game,reveal,shot}=setup();reveal('SANTA');
 for(const color of ['green','red']){const result=game.scan(color,shot());assert.equal(result.kind,'penalty');assert.equal(result.points,0);assert.equal(game.players[color].score,0);assert.equal(game.players[color].mistakes,1);}
 assert.equal(game.scan('green',shot()).accepted,false);assert.deepEqual(game.encounter.penalized,['green','red']);
});
test('holding fire resolves Santa and reindeer safely without farming points or breaking a streak',()=>{
 const {game,reveal,shot,at}=setup();reveal();game.scan('green',shot());reveal('DEER');const before=game.players.green.score;
 at(game.encounter.concealAt);assert.equal(game.encounter.outcome,'safe');assert.equal(game.targets.some(t=>t.active),false);assert.equal(game.players.green.score,before);assert.equal(game.players.green.streak,1);
 assert.equal(game.scan('green',shot()).accepted,false);
});
test('letting a snowman escape loses the opportunity without resetting clean trigger decisions',()=>{
 const {game,reveal,shot,at}=setup();reveal();game.scan('green',shot());reveal('SNOW');at(game.encounter.concealAt);
 assert.equal(game.encounter.outcome,'escaped');assert.equal(game.players.green.streak,1);assert.equal(game.players.green.score,10);
});
test('only one animal is interactive, and only during its stationary reveal',()=>{
 const {game,at}=setup();
 for(let t=game.startedAt;t<game.endsAt;t+=37){at(t);const active=game.targets.filter(a=>a.active);assert.ok(active.length<=1);assert.equal(active.length===1,encounterPhase(game.encounter,t)==='reveal');if(active.length)assert.equal(active[0].code,game.encounter.code);}
});
test('exposure boundaries reject hidden, unknown, and expired animal codes',()=>{
 const {game,reveal,shot,at}=setup();const first=game.encounter;at(first.revealAt-1);assert.equal(game.scan('green',shot()).accepted,false);
 reveal();assert.equal(game.scan('green',shot('UNKNOWN')).accepted,false);assert.equal(game.scan('green',shot('SANTA')).accepted,false);
 reveal('DEER');const e={...game.encounter};
 assert.equal(game.scan('green',shot()).accepted,true);at(e.concealAt-1);assert.equal(game.scan('red',shot()).accepted,true);at(e.concealAt);assert.equal(game.scan('red',shot()).accepted,false);
 assert.deepEqual(encounterPose(e,e.revealAt),encounterPose(e,e.concealAt-1));
});
test('a clear hands off to the next scannable animal in 1.25 seconds',()=>{
 const {game,reveal,shot,at}=setup();reveal();const hitAt=game.clock();game.scan('green',shot());
 at(hitAt+CLEAR_MS-1);assert.equal(game.targets.some(t=>t.active),false);at(hitAt+CLEAR_MS);assert.equal(game.targets.some(t=>t.active),false);
 assert.equal(game.encounter.revealAt-hitAt,CLEAR_MS+APPROACH_MS+PEEK_MS+DODGE_MS);assert.equal(game.encounter.revealAt-hitAt,1250);
 at(game.encounter.revealAt);assert.equal(game.targets.filter(t=>t.active).length,1);
});
test('a shuffled bag preserves scoring/hold-fire balance and the first target teaches the rule',()=>{
 const {game,next}=setup();const codes=[];
 for(let i=0;i<8;i++){codes.push(game.encounter.code);assert.ok(game.encounter.path>=0&&game.encounter.path<4);next();}
 assert.equal(codes[0],'SNOW');assert.deepEqual(codes.toSorted(),ENCOUNTER_BAG.toSorted());
});
test('alternating mode gates good shots and penalties using the current 15-second turn',()=>{
 const {game,reveal,shot,at}=setup('alternating',{firstColor:'red'});reveal();
 assert.equal(game.scan('green',shot()).reason,'Wait for your turn.');assert.equal(game.scan('red',shot()).accepted,true);
 at(game.startedAt+15000);reveal();assert.equal(game.turn,'green');assert.equal(game.scan('red',shot()).accepted,false);assert.equal(game.scan('green',shot()).accepted,true);
});
test('single player supports red and excludes the other scanner from actions and saved results',()=>{
 const {game,reveal,shot,rounds}=setup('single',{singleColor:'red'});reveal();
 assert.equal(game.scan('green',shot()).accepted,false);assert.equal(game.scan('red',shot()).points,10);game.finish();
 assert.equal(rounds[0].players.length,1);assert.equal(rounds[0].players[0].color,'red');assert.equal(rounds[0].ruleset,RULESET);
});
test('the exact deadline ends play and saves the ruleset and statistics once',()=>{
 const {game,reveal,shot,rounds,at}=setup();reveal();game.scan('green',shot());at(game.startedAt+ROUND_MS);
 assert.equal(game.scan('red',shot()).accepted,false);game.tick();game.finish();assert.equal(rounds.length,1);assert.equal(rounds[0].ruleset,RULESET);assert.equal(rounds[0].players[0].streak,1);assert.equal(game.targets.some(t=>t.active),false);
});
test('reset clears points, streaks, mistakes, names, bag, and round identity',()=>{
 const {game,reveal,shot}=setup();reveal();const old=shot();game.scan('green',old);game.finish();game.reset();
 assert.equal(game.players.green.score,0);assert.equal(game.players.green.streak,0);assert.equal(game.players.green.bestStreak,0);assert.equal(game.players.green.mistakes,0);assert.equal(game.players.green.name,'');assert.equal(game.encounter,null);assert.deepEqual(game.bag,[]);
 game.configure({mode:'simultaneous',names:{green:'G',red:'R'}});game.start();assert.equal(game.scan('green',old).reason,'Old round ignored.');
});
test('reduced motion retains the same decision windows with a stationary full animal',()=>{
 const {game}=setup();const e=game.encounter,a=encounterPose(e,e.startedAt,true),b=encounterPose(e,e.revealAt,true);
 for(const field of ['x','floor','z','yaw','bob'])assert.equal(a[field],b[field]);assert.equal(a.phase,'approach');assert.equal(b.phase,'reveal');
});
test('name validation rejects control characters and oversize names',()=>{
 const game=new Game();assert.throws(()=>game.name('green','x\n'));assert.throws(()=>game.name('green','x'.repeat(25)));game.name('green','<Player>');assert.equal(game.players.green.name,'<Player>');
});
test('scanner capture still emits each Enter immediately, including new deer codes',()=>{
 let now=100;const values=[],scanner=createScanner((payload,at)=>values.push({payload,at}),()=>now++);
 const type=text=>{for(const key of text)scanner({key});scanner({key:'Enter'});};type('SNOW');type('SNOW');type('deer');assert.deepEqual(values.map(v=>v.payload),['SNOW','SNOW','DEER']);
 scanner({key:'T'});now+=1001;scanner({key:'Enter'});assert.equal(values.length,3);scanner({key:'D'});scanner.reset();scanner({key:'Enter'});assert.equal(values.length,3);
});

