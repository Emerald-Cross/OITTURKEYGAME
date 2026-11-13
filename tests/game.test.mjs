import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, ROUND_MS } from '../lib/game.mjs';
import { encounterPhase, encounterPose } from '../public/encounters.js';
import { createScanner } from '../public/scanner.js';
function setup(mode = 'simultaneous', extra = {}) {
  let now = 100000;
  const rounds = [], game = new Game({ clock: () => now, onFinish: r => rounds.push(r) });
  game.configure({ mode, names: { green: 'Grace', red: 'Rowan' }, ...extra }); game.start();
  let seq = 0;
  const shot = (code = game.encounter.code, props = {}) => ({ payload:code, roundId:game.roundId, spawnId:game.targets.find(t=>t.code===code)?.spawnId, eventId:`event-${++seq}-test`, ...props });
  const at = value => { now = value; game.tick(); };
  const reveal = (code = game.encounter.code) => {
    while (game.encounter.code !== code) at(game.encounter.nextAt);
    at(game.encounter.revealAt); return game.targets.find(t=>t.code===code);
  };
  return { game, rounds, shot, at, reveal, advance: ms => at(now + ms) };
}
test('only one animal can score, and only while its code is exposed', () => {
  const {game, shot, at} = setup();
  for (let now = game.startedAt; now < game.endsAt; now += 23) {
    at(now); const active = game.targets.filter(t=>t.active);
    assert.ok(active.length <= 1);
    assert.equal(active.length === 1, encounterPhase(game.encounter, now) === 'reveal');
    if (active.length) assert.equal(active[0].code, game.encounter.code);
    else assert.equal(game.scan('green', shot()).accepted, false);
  }
});
test('reveal boundaries are exact; the TV pose is square and stationary throughout the scan window', () => {
  const {game, shot, at, reveal} = setup(); reveal('BEAR'); const e = {...game.encounter};
  at(e.revealAt - 1); assert.equal(game.scan('green',shot()).accepted,false);
  at(e.revealAt); assert.equal(game.scan('green',shot()).accepted,true);
  assert.deepEqual(encounterPose(e,e.revealAt),encounterPose(e,e.concealAt-1));
  at(e.concealAt - 1); assert.equal(game.scan('green',shot()).accepted,true);
  at(e.concealAt); assert.equal(game.scan('green',shot()).accepted,false);
  assert.equal(encounterPose(e,e.revealAt).yaw,0); assert.equal(encounterPose(e,e.revealAt).z,0);
});
test('both players damage shared health and receive per-hit credit without cooldown', () => {
  const {game,shot,reveal} = setup(); reveal('TKY4');
  for (const color of ['green','red','green','red']) assert.equal(game.scan(color,shot()).accepted,true);
  assert.equal(game.targets[1].hp,0); assert.equal(game.players.green.score,50); assert.equal(game.players.red.score,50);
  assert.equal(game.players.red.kills,1); assert.equal(game.players.green.hits,2);
  assert.equal(game.targets.filter(t=>t.active).length,0,'Clearing a target hides its code synchronously');
});
test('same delivery is idempotent; fresh repeated scan IDs remain legitimate', () => {
  const {game,shot,reveal} = setup(); reveal('TKY4'); const data=shot();
  const first=game.scan('green',data), duplicate=game.scan('green',data);
  assert.equal(duplicate.duplicate,true);assert.equal(duplicate.score,first.score);assert.equal(game.targets[1].hp,3);
  assert.equal(game.scan('green',shot()).accepted,true);assert.equal(game.targets[1].hp,2);
});
test('surviving animals retain damage; returning appearances reject delayed scans', () => {
  const {game,shot,reveal,at}=setup(); reveal('TKY4');
  const old=shot(); assert.equal(game.scan('red',old).accepted,true);
  at(game.encounter.concealAt);assert.equal(game.scan('green',shot()).accepted,false);
  at(game.encounter.nextAt);reveal('TKY4');assert.equal(game.targets[1].hp,3);
  assert.notEqual(game.targets[1].spawnId,old.spawnId);
  assert.equal(game.scan('red',{...old,eventId:'delayed-new-id'}).accepted,false);
  assert.equal(game.scan('red',old).duplicate,true);
  assert.equal(game.scan('red',shot()).accepted,true);assert.equal(game.targets[1].hp,2);
});
test('cleared animals return at full health; the following encounter never overlaps their code', () => {
  const {game,shot,reveal,at}=setup(); reveal('TKY1');const old=shot();game.scan('green',old);
  assert.equal(game.targets[0].active,false); assert.equal(game.encounter.clearedAt,game.clock());
  assert.equal(game.scan('red',shot()).accepted,false);
  at(game.encounter.nextAt);assert.equal(game.targets.some(t=>t.active),false);
  reveal('TKY1');assert.equal(game.targets[0].hp,1);
  assert.equal(game.scan('red',{...old,eventId:'old-appearance-id'}).accepted,false);
  assert.equal(game.scan('green',shot('DEER')).accepted,false);
});
test('exact deadline ends the round, persists once, and rejects further hits', () => {
  const {game,shot,reveal,at,rounds}=setup();reveal('TKY4');assert.equal(game.scan('green',shot()).accepted,true);
  at(game.startedAt+ROUND_MS);assert.equal(game.scan('red',shot()).accepted,false);game.tick();game.finish();
  assert.equal(rounds.length,1);assert.equal(rounds[0].players[0].score,25);assert.equal(game.phase,'results');
  assert.equal(game.targets.some(t=>t.active),false);
});
test('reset clears encounter state and rejects scans from the prior round', () => {
  const {game,shot,reveal}=setup();reveal('TKY4');const old=shot();game.finish();game.reset();
  assert.equal(game.players.green.score,0);assert.equal(game.players.green.name,'');assert.equal(game.targets[1].hp,4);assert.equal(game.encounter,null);
  game.configure({mode:'simultaneous',names:{green:'Next G',red:'Next R'}});game.start();
  assert.equal(game.scan('green',old).reason,'Old round ignored.');
});
test('alternating mode changes every 15 seconds from the chosen scanner', () => {
  const {game,shot,reveal,at}=setup('alternating',{firstColor:'red'});reveal('TKY4');
  assert.equal(game.scan('green',shot()).accepted,false);assert.equal(game.scan('red',shot()).accepted,true);
  at(game.startedAt+15000);assert.equal(game.turn,'green');assert.equal(game.scan('red',shot()).accepted,false);assert.equal(game.scan('green',shot()).accepted,true);
});
test('single player permits either chosen color and records only that player', () => {
  const {game,shot,reveal,rounds}=setup('single',{singleColor:'red'});reveal('BEAR');
  assert.equal(game.scan('green',shot()).accepted,false);assert.equal(game.scan('red',shot()).points,40);
  game.finish();assert.equal(rounds[0].players.length,1);assert.equal(rounds[0].players[0].color,'red');
});
test('a sleeping server catches up its encounter timeline and turn in one tick', () => {
  const {game,at}=setup('alternating');at(game.startedAt+73000);
  assert.ok(game.encounter.index>4);assert.ok(game.encounter.startedAt<=game.clock());assert.ok(game.encounter.nextAt>game.clock());
  assert.ok(game.targets.filter(t=>t.active).length<=1);assert.equal(game.turn,'green');
});
test('reduced motion uses the same scan window and a stationary animal', () => {
  const {game}=setup(); const e=game.encounter;
  const a=encounterPose(e,e.startedAt,true),b=encounterPose(e,e.revealAt,true);
  for(const field of ['x','floor','z','yaw','bob'])assert.equal(a[field],b[field]);
  assert.equal(a.phase,'approach');assert.equal(b.phase,'reveal');
});
test('name validation rejects control characters and oversize names',()=>{
 const game=new Game();assert.throws(()=>game.name('green','x\n'));assert.throws(()=>game.name('green','x'.repeat(25)));game.name('green','<Player>');assert.equal(game.players.green.name,'<Player>');
});
test('scanner emits synchronously on Enter, with repeated shots, timeout, and focus reset', () => {
  let now=100, values=[];const scanner=createScanner((payload,at)=>values.push({payload,at}),()=>now++);
  const type=text=>{for(const key of text)scanner({key});scanner({key:'Enter'});};
  type('TKY4');type('TKY4');type('bear');assert.deepEqual(values.map(v=>v.payload),['TKY4','TKY4','BEAR']);
  scanner({key:'T'});now+=1001;scanner({key:'Enter'});assert.equal(values.length,3);
  scanner({key:'T'});scanner.reset();scanner({key:'Enter'});assert.equal(values.length,3);
});
