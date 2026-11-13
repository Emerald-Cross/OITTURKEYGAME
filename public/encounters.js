// Shared encounter timing: the server decides when a code can score; the TV
// animates the same timeline without sending animation frames over the network.
export const RULESET = 'christmas-v1';
export const ANIMALS = {
  SNOW: { code: 'SNOW', label: 'Snowman', action: 'shoot', maxHp: 1, points: 10, art: 'snowman', call: 'Brrr!' },
  GIFT: { code: 'GIFT', label: 'Gold present', action: 'shoot', maxHp: 1, points: 30, art: 'gift', call: '' },
  SANTA: { code: 'SANTA', label: 'Santa', action: 'avoid', maxHp: 1, points: 0, penalty: 25, art: 'santa', call: 'Ho ho ho' },
  DEER: { code: 'DEER', label: 'Reindeer', action: 'avoid', maxHp: 1, points: 0, penalty: 25, art: 'reindeer', call: '' }
};
// Shuffle a balanced bag on the server: six scoring targets, two hold-fire targets.
export const ENCOUNTER_BAG = ['SNOW', 'SNOW', 'SNOW', 'SNOW', 'GIFT', 'GIFT', 'DEER', 'SANTA'];
export const scoreMultiplier = streak => Math.min(3, 1 + Math.floor((streak || 0) / 3));
export const REVEAL_MS = { SNOW: 5000, GIFT: 5000, SANTA: 3000, DEER: 3000 };
export const APPROACH_MS = 450;
export const PEEK_MS = 150;
export const DODGE_MS = 200;
export const RETREAT_MS = 500;
export const QUIET_MS = 150;
export const CLEAR_MS = 450;

export function encounterPhase(encounter, now) {
  if (!encounter) return 'quiet';
  if (encounter.clearedAt !== null) return now < encounter.exitsAt ? 'cleared' : 'quiet';
  if (now < encounter.startedAt + APPROACH_MS) return 'approach';
  if (now < encounter.startedAt + APPROACH_MS + PEEK_MS) return 'peek';
  if (now < encounter.revealAt) return 'dodge';
  if (now < encounter.concealAt) return 'reveal';
  if (now < encounter.exitsAt) return 'retreat';
  return 'quiet';
}

const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => 1 - (1 - clamp(n)) ** 3;
const mix = (a, b, t) => a + (b - a) * t;
const paths = [
  { from: 64, to: 51, exit: 22, facing: -1 },
  { from: 16, to: 35, exit: 9, facing: 1 },
  { from: 88, to: 66, exit: 94, facing: -1 },
  { from: 45, to: 48, exit: 79, facing: 1 }
];

// A billboard moves through a CSS perspective scene in x, y, and z. During a
// reveal its entire transform is fixed, keeping the original QR grid square.
export function encounterPose(encounter, now, reducedMotion = false) {
  const phase = encounterPhase(encounter, now);
  const path = paths[encounter?.path ?? 0];
  const base = { phase, x: path.to, floor: 3, z: 0, yaw: 0, bob: 0, opacity: phase === 'quiet' ? 0 : 1 };
  if (reducedMotion || phase === 'reveal' || phase === 'cleared' || phase === 'quiet') return base;
  if (phase === 'approach') {
    const t = clamp((now - encounter.startedAt) / APPROACH_MS), p = ease(t);
    return { ...base, x: mix(path.from, path.to, p), floor: mix(26, 5, p), z: mix(-1800, -220, p), yaw: path.facing * (1 - p) * 32,
      bob: -Math.abs(Math.sin(t * Math.PI * 6)) * 12, opacity: Math.min(1, t * 6) };
  }
  if (phase === 'peek') return { ...base, floor: 5, z: -220, bob: 12 };
  if (phase === 'dodge') {
    const t = clamp((now - encounter.startedAt - APPROACH_MS - PEEK_MS) / DODGE_MS);
    return { ...base, x: path.to + Math.sin(t * Math.PI * 2) * 3.5, floor: mix(5, 3, ease(t)), z: mix(-220, 0, ease(t)),
      yaw: Math.sin(t * Math.PI * 2) * 16, bob: -Math.sin(t * Math.PI) * 24 };
  }
  const t = clamp((now - encounter.concealAt) / RETREAT_MS), p = ease(t);
  return { ...base, x: mix(path.to, path.exit, p), floor: mix(3, 10, p), z: mix(0, -1000, p), yaw: path.facing * p * -35,
    bob: -Math.abs(Math.sin(t * Math.PI * 4)) * 16, opacity: 1 - t };
}

