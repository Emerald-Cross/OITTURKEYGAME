import { randomUUID } from 'node:crypto';
import { RULESET, ANIMALS, ENCOUNTER_BAG, scoreMultiplier, REVEAL_MS, APPROACH_MS, PEEK_MS, DODGE_MS, RETREAT_MS, QUIET_MS, CLEAR_MS } from '../public/encounters.js';
export { RULESET };
export const COLORS = ['green', 'red'];
export const ROUND_MS = 120_000;
export const TURN_MS = 15_000;
export const TARGETS = Object.values(ANIMALS);
export function cleanName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 24 || /[\p{C}]/u.test(value)) throw Error('Use a name of 1–24 visible characters.');
  return value.trim();
}
export class Game {
  constructor({ clock = Date.now, onFinish = () => {}, random = Math.random } = {}) {
    this.clock = clock; this.onFinish = onFinish; this.random = random; this.version = 0;
    this.reset();
  }
  reset() {
    if (this.phase === 'playing') throw Error('End this round before preparing the next group.');
    this.roundId = randomUUID(); this.phase = 'lobby'; this.mode = 'simultaneous';
    this.singleColor = 'green'; this.firstColor = 'green'; this.startedAt = null; this.endsAt = null;
    this.players = Object.fromEntries(COLORS.map(color => [color, { color, name: '', score: 0, hits: 0, kills: 0, streak: 0, bestStreak: 0, mistakes: 0 }]));
    this.targets = TARGETS.map(t => ({ ...t, hp: t.maxHp, active: false, spawnId: randomUUID(), respawnAt: null, lastColor: null }));
    this.deliveries = new Map(); this.turn = null; this.encounter = null; this.bag = []; this.version++;
  }
  configure({ mode, singleColor = 'green', firstColor = 'green', names = {} }) {
    if (this.phase !== 'lobby') throw Error('Prepare the next group before changing settings.');
    if (!['simultaneous', 'alternating', 'single'].includes(mode) || !COLORS.includes(singleColor) || !COLORS.includes(firstColor)) throw Error('Choose a valid mode and scanner.');
    const cleaned = {};
    for (const color of COLORS) if (names[color]) cleaned[color] = cleanName(names[color]);
    this.mode = mode; this.singleColor = singleColor; this.firstColor = firstColor;
    for (const [color, name] of Object.entries(cleaned)) this.players[color].name = name;
    this.version++;
  }
  name(color, name) {
    if (this.phase !== 'lobby' || !COLORS.includes(color)) throw Error('Names can be entered while preparing a group.');
    this.players[color].name = cleanName(name); this.version++;
  }
  participants() { return this.mode === 'single' ? [this.singleColor] : COLORS; }
  activeColor(now = this.clock()) {
    if (this.mode === 'single') return this.singleColor;
    if (this.mode !== 'alternating') return null;
    return Math.floor((now - this.startedAt) / TURN_MS) % 2 ? COLORS.find(c => c !== this.firstColor) : this.firstColor;
  }
  start() {
    if (this.phase !== 'lobby') throw Error('Prepare a group first.');
    if (this.participants().some(c => !this.players[c].name)) throw Error('Enter a name for each participating player.');
    const now = this.clock(); this.startedAt = now; this.endsAt = now + ROUND_MS; this.phase = 'playing';
    this.targets.forEach(t => { t.active = false; t.hp = t.maxHp; });
    this.beginEncounter(0, now);
    this.turn = this.activeColor(now); this.version++;
  }
  finish(reason = 'Time up') {
    if (this.phase !== 'playing') return false;
    this.phase = 'results'; this.targets.forEach(t => { t.active = false; }); this.version++;
    this.onFinish({ roundId: this.roundId, ruleset: RULESET, mode: this.mode, reason, endedAt: new Date(this.clock()).toISOString(),
      players: this.participants().map(c => ({ ...this.players[c] })) });
    return true;
  }
  beginEncounter(index, at) {
    if (!this.bag.length) {
      this.bag = [...ENCOUNTER_BAG];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    // Start with a snowman so the first scan demonstrates the main rule.
    let position = index === 0 ? this.bag.indexOf('SNOW') : 0;
    // Keep hold-fire encounters apart whenever the remaining bag allows it.
    if (index > 0 && ANIMALS[this.encounter.code].action === 'avoid' && ANIMALS[this.bag[position]].action === 'avoid') {
      const scoring = this.bag.findIndex(code => ANIMALS[code].action === 'shoot');
      if (scoring >= 0) position = scoring;
    }
    const [code] = this.bag.splice(position, 1);
    const target = this.targets.find(t => t.code === code);
    this.targets.forEach(t => { t.active = false; });
    // Every appearance gets a new incarnation.
    // A delayed delivery must never damage a later appearance of the same QR.
    Object.assign(target, { hp: 1, spawnId: randomUUID(), respawnAt: null, lastColor: null });
    const revealAt = at + APPROACH_MS + PEEK_MS + DODGE_MS;
    const concealAt = revealAt + REVEAL_MS[code];
    this.encounter = { id: randomUUID(), index, code, path: Math.floor(this.random() * 4), startedAt: at, revealAt, concealAt,
      exitsAt: concealAt + RETREAT_MS, nextAt: concealAt + RETREAT_MS + QUIET_MS, clearedAt: null, outcome: null, penalized: [] };
  }
  resolveEncounter(now) {
    const e = this.encounter;
    if (!e.outcome && now >= e.concealAt) { e.outcome = ANIMALS[e.code].action === 'avoid' && !e.penalized.length ? 'safe' : 'escaped'; return true; }
    return false;
  }
  tick(now = this.clock()) {
    if (this.phase !== 'playing') return false;
    if (now >= this.endsAt) return this.finish();
    let changed = false;
    while (now >= this.encounter.nextAt) {
      this.resolveEncounter(now);
      this.beginEncounter(this.encounter.index + 1, this.encounter.nextAt); changed = true;
    }
    if (this.resolveEncounter(now)) changed = true;
    for (const target of this.targets) {
      const active = target.code === this.encounter.code && this.encounter.clearedAt === null && now >= this.encounter.revealAt && now < this.encounter.concealAt;
      if (target.active !== active) { target.active = active; changed = true; }
    }
    const next = this.activeColor(now);
    if (next !== this.turn) { this.turn = next; changed = true; }
    if (changed) this.version++;
    return changed;
  }
  scan(color, data) {
    const now = this.clock(); this.tick(now);
    const reject = reason => ({ accepted: false, reason, eventId: data?.eventId });
    if (!data || typeof data !== 'object' || !COLORS.includes(color)) return reject('Invalid scan.');
    if (data.roundId !== this.roundId) return reject('Old round ignored.');
    if (typeof data.eventId !== 'string' || !/^[\w-]{8,96}$/.test(data.eventId)) return reject('Invalid event ID.');
    // An event ID identifies one Enter event, never a target code.
    const key = `${color}:${data.eventId}`;
    if (this.deliveries.has(key)) return { ...this.deliveries.get(key), duplicate: true };
    if (this.deliveries.size >= 20_000) return reject('Round submission limit reached.');
    const remember = result => { this.deliveries.set(key, result); return result; };
    if (this.phase !== 'playing') return remember(reject('No active round.'));
    if (!this.participants().includes(color) || (this.mode === 'alternating' && color !== this.activeColor(now))) return remember(reject('Wait for your turn.'));
    const target = this.targets.find(t => t.code === data.payload);
    if (!target) return remember(reject('Unknown code.'));
    if (!target.active || target.spawnId !== data.spawnId) return remember(reject('Target inactive or replaced.'));
    const player = this.players[color];
    if (target.action === 'avoid') {
      // A held trigger cannot repeatedly deduct points from the same appearance.
      if (this.encounter.penalized.includes(color)) return remember(reject('Already counted this target.'));
      this.encounter.penalized.push(color);
      const points = player.score > 0 ? -Math.min(target.penalty, player.score) : 0;
      player.score += points; player.mistakes++; player.streak = 0; this.version++;
      return remember({ accepted: true, kind: 'penalty', eventId: data.eventId, color, code: target.code, hp: 1, points, penalty: target.penalty,
        killed: false, score: player.score, streak: 0, multiplier: 1 });
    }
    const multiplier = scoreMultiplier(player.streak), points = target.points * multiplier;
    target.hp = 0; target.active = false; target.lastColor = color;
    player.score += points; player.hits++; player.kills++; player.streak++; player.bestStreak = Math.max(player.bestStreak, player.streak);
    Object.assign(this.encounter, { clearedAt: now, concealAt: now, exitsAt: now + CLEAR_MS, nextAt: now + CLEAR_MS, outcome: 'hit' });
    this.version++;
    return remember({ accepted: true, kind: 'hit', eventId: data.eventId, color, code: target.code, hp: 0, points, basePoints: target.points,
      killed: true, score: player.score, streak: player.streak, multiplier });
  }
  snapshot() {
    return structuredClone({ roundId: this.roundId, version: this.version, phase: this.phase, mode: this.mode, singleColor: this.singleColor,
      firstColor: this.firstColor, startedAt: this.startedAt, endsAt: this.endsAt, turn: this.turn, turnMs: TURN_MS,
      ruleset: RULESET, players: this.players, targets: this.targets, encounter: this.encounter, serverNow: this.clock() });
  }
}

