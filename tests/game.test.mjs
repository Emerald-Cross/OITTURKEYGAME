import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, ROUND_MS } from '../lib/game.mjs';
import { createScanner } from '../public/scanner.js';
function setup(mode = 'simultaneous', extra = {}) {
  let now = 100000;
  const rounds = [];
  const game = new Game({ clock: () => now, onFinish: r => rounds.push(r) });
  game.configure({ mode, names: { green: 'Grace', red: 'Rowan' }, ...extra }); game.start();
  let seq = 0;
  const shot = (code = 'TKY4', props = {}) => ({ payload:code, roundId:game.roundId, spawnId:game.targets.find(t=>t.code===code)?.spawnId, eventId:`event-${++seq}-test`, ...props });
  return { game, rounds, shot, advance: ms => { now += ms; } };
}
test('both players damage shared health and receive per-hit credit without cooldown', () => {
  const {game,shot} = setup();
  for (const color of ['green','red','green','red']) assert.equal(game.scan(color,shot()).accepted,true);
  assert.equal(game.targets[1].hp,0); assert.equal(game.players.green.score,50); assert.equal(game.players.red.score,50);
  assert.equal(game.players.red.kills,1); assert.equal(game.players.green.hits,2);
});
test('same delivery is idempotent; fresh repeated scan IDs remain legitimate', () => {
  const {game,shot} = setup();const data=shot();
  const first=game.scan('green',data); const duplicate=game.scan('green',data);
  assert.equal(duplicate.duplicate,true);assert.equal(duplicate.score,first.score);assert.equal(game.targets[1].hp,3);
  assert.equal(game.scan('green',shot()).accepted,true);assert.equal(game.targets[1].hp,2);
});
test('inactive targets, unknown codes, and delayed scans for a replaced target are rejected', () => {
  const {game,shot,advance}=setup();const old=shot('TKY1');game.scan('red',old);
  assert.equal(game.scan('green',shot('TKY1')).accepted,false);
  assert.equal(game.scan('green',shot('DEER')).accepted,false);
  advance(1800);game.tick();assert.equal(game.targets[0].hp,1);
  assert.equal(game.scan('red',{...old,eventId:'delayed-new-id'}).accepted,false);
  assert.equal(game.scan('red',shot('TKY1')).accepted,true);
});
test('exact deadline ends the round, persists once, and rejects further hits', () => {
  const {game,shot,advance,rounds}=setup();advance(ROUND_MS-1);assert.equal(game.scan('green',shot()).accepted,true);
  advance(1);assert.equal(game.scan('red',shot()).accepted,false);game.tick();game.finish();
  assert.equal(rounds.length,1);assert.equal(rounds[0].players[0].score,25);assert.equal(game.phase,'results');
});
test('reset changes round identity and rejects scans from the prior round', () => {
  const {game,shot}=setup();const old=shot();game.finish();game.reset();
  assert.equal(game.players.green.score,0);assert.equal(game.players.green.name,'');assert.equal(game.targets[1].hp,4);
  game.configure({mode:'simultaneous',names:{green:'Next G',red:'Next R'}});game.start();
  assert.equal(game.scan('green',old).reason,'Old round ignored.');
});
test('alternating mode changes every 15 seconds, starts with chosen scanner', () => {
  const {game,shot,advance}=setup('alternating',{firstColor:'red'});
  assert.equal(game.scan('green',shot()).accepted,false);assert.equal(game.scan('red',shot()).accepted,true);
  advance(15000);game.tick();assert.equal(game.turn,'green');assert.equal(game.scan('red',shot()).accepted,false);assert.equal(game.scan('green',shot()).accepted,true);
});
test('single player permits either chosen color and records only that player', () => {
  const {game,shot,rounds}=setup('single',{singleColor:'red'});
  assert.equal(game.scan('green',shot()).accepted,false);assert.equal(game.scan('red',shot('BEAR')).points,40);
  game.finish();assert.equal(rounds[0].players.length,1);assert.equal(rounds[0].players[0].color,'red');
});
test('name validation rejects control characters and oversize names',()=>{
 const game=new Game();assert.throws(()=>game.name('green','x\n'));assert.throws(()=>game.name('green','x'.repeat(25)));game.name('green','<Player>');assert.equal(game.players.green.name,'<Player>');
});
test('scanner emits synchronously on Enter, supports short payloads and repeated shots', () => {
  let now=100, values=[];const scanner=createScanner((payload,at)=>values.push({payload,at}),()=>now++);
  const type=text=>{for(const key of text)scanner({key});scanner({key:'Enter'});};
  type('TKY4');type('TKY4');type('bear');assert.deepEqual(values.map(v=>v.payload),['TKY4','TKY4','BEAR']);
  scanner({key:'T'});now+=1001;scanner({key:'Enter'});assert.equal(values.length,3);
  scanner({key:'T'});scanner.reset();scanner({key:'Enter'});assert.equal(values.length,3);
});
