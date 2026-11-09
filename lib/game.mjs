import { randomUUID } from 'node:crypto';
import { ENCOUNTER_PATTERN, REVEAL_MS, APPROACH_MS, PEEK_MS, DODGE_MS, RETREAT_MS, QUIET_MS, CLEAR_MS } from '../public/encounters.js';
export const COLORS = ['green', 'red'];
export const ROUND_MS = 120_000;
export const TURN_MS = 15_000;
export const TARGETS = [
  { code: 'TKY1', label: 'Turkey', maxHp: 1, points: 10, lane: 0 },
  { code: 'TKY4', label: 'Tough turkey', maxHp: 4, points: 25, lane: 1 },
  { code: 'BEAR', label: 'Bear', maxHp: 6, points: 40, lane: 2 }
];
export function cleanName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 24 || /[\p{C}]/u.test(value)) throw Error('Use a name of 1–24 visible characters.');
  return value.trim();
}
export class Game {
  constructor({ clock = Date.now, onFinish = () => {} } = {}) {
    this.clock = clock; this.onFinish = onFinish; this.version = 0;
    this.reset();
  }
  reset() {
    if (this.phase === 'playing') throw Error('End this round before preparing the next group.');
    this.roundId = randomUUID(); this.phase = 'lobby'; this.mode = 'simultaneous';
    this.singleColor = 'green'; this.firstColor = 'green'; this.startedAt = null; this.endsAt = null;
    this.players = Object.fromEntries(COLORS.map(color => [color, { color, name: '', score: 0, hits: 0, kills: 0 }]));
    this.targets = TARGETS.map(t => ({ ...t, hp: t.maxHp, active: false, spawnId: randomUUID(), respawnAt: null, lastColor: null }));
    this.deliveries = new Map(); this.turn = null; this.encounter = null; this.version++;
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
    this.onFinish({ roundId: this.roundId, mode: this.mode, reason, endedAt: new Date(this.clock()).toISOString(),
      players: this.participants().map(c => ({ ...this.players[c] })) });
    return true;
  }
  beginEncounter(index, at) {
    const code = ENCOUNTER_PATTERN[index % ENCOUNTER_PATTERN.length];
    const target = this.targets.find(t => t.code === code);
    this.targets.forEach(t => { t.active = false; });
    // Every appearance gets a new incarnation, even when an animal survived.
    // A delayed delivery must never damage a later appearance of the same QR.
    Object.assign(target, { hp: target.hp || target.maxHp, spawnId: randomUUID(), respawnAt: null });
    const revealAt = at + APPROACH_MS + PEEK_MS + DODGE_MS;
    const concealAt = revealAt + REVEAL_MS[code];
    this.encounter = { id: randomUUID(), index, code, path: index % 4, startedAt: at, revealAt, concealAt,
      exitsAt: concealAt + RETREAT_MS, nextAt: concealAt + RETREAT_MS + QUIET_MS, clearedAt: null };
  }
  tick(now = this.clock()) {
    if (this.phase !== 'playing') return false;
    if (now >= this.endsAt) return this.finish();
    let changed = false;
    while (now >= this.encounter.nextAt) {
      this.beginEncounter(this.encounter.index + 1, this.encounter.nextAt); changed = true;
    }
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
    // An event ID identifies one Enter event, never a target code. No target cooldown.
    const key = `${color}:${data.eventId}`;
    if (this.deliveries.has(key)) return { ...this.deliveries.get(key), duplicate: true };
    if (this.deliveries.size >= 20_000) return reject('Round submission limit reached.');
    const remember = result => { this.deliveries.set(key, result); return result; };
    if (this.phase !== 'playing') return remember(reject('No active round.'));
    if (!this.participants().includes(color) || (this.mode === 'alternating' && color !== this.activeColor(now))) return remember(reject('Wait for your turn.'));
    const target = this.targets.find(t => t.code === data.payload);
    if (!target) return remember(reject('Unknown code.'));
    if (!target.active || target.spawnId !== data.spawnId) return remember(reject('Target inactive or replaced.'));
    target.hp--; target.lastColor = color;
    const player = this.players[color]; player.score += target.points; player.hits++;
    if (target.hp === 0) {
      target.active = false; player.kills++;
      Object.assign(this.encounter, { clearedAt: now, concealAt: now, exitsAt: now + 750, nextAt: now + CLEAR_MS });
      target.respawnAt = null;
    }
    this.version++;
    return remember({ accepted: true, eventId: data.eventId, color, code: target.code, hp: target.hp, points: target.points, killed: !target.active, score: player.score });
  }
  snapshot() {
    return structuredClone({ roundId: this.roundId, version: this.version, phase: this.phase, mode: this.mode, singleColor: this.singleColor,
      firstColor: this.firstColor, startedAt: this.startedAt, endsAt: this.endsAt, turn: this.turn, turnMs: TURN_MS,
      players: this.players, targets: this.targets, encounter: this.encounter, serverNow: this.clock() });
  }
}
