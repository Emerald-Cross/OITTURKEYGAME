// Shared encounter timing: the server decides when a code can score; the TV
// animates the same timeline without sending animation frames over the network.
export const ENCOUNTER_PATTERN = ['TKY1', 'TKY4', 'TKY1', 'BEAR', 'TKY4', 'TKY1', 'BEAR', 'TKY4'];
export const REVEAL_MS = { TKY1: 5200, TKY4: 6500, BEAR: 7200 };
export const APPROACH_MS = 1700;
export const PEEK_MS = 450;
export const DODGE_MS = 650;
export const RETREAT_MS = 850;
export const QUIET_MS = 400;
export const CLEAR_MS = 1250;

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
