// Small, optional synthesized effects; no downloads and no sound before a user gesture.
export function createSound() {
  let context, enabled = false;
  const tone = (frequency, start, length, gain = .035, type = 'sine') => {
    const oscillator = context.createOscillator(), volume = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(0, start); volume.gain.linearRampToValueAtTime(gain, start + .006);
    volume.gain.exponentialRampToValueAtTime(.001, start + length);
    oscillator.connect(volume).connect(context.destination); oscillator.start(start); oscillator.stop(start + length + .01);
  };
  return {
    toggle() {
      try {
        if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
        if (context.state === 'suspended') context.resume().catch(() => {});
        enabled = !enabled; return enabled;
      } catch { enabled = false; return false; }
    },
    play(kind) {
      if (!enabled || context?.state !== 'running') return;
      const at = context.currentTime;
      if (kind === 'hit') { tone(400, at, .06, .03, 'triangle'); tone(230, at + .025, .09, .025, 'triangle'); }
      if (kind === 'clear') [620,430,760].forEach((f,i) => tone(f, at + i*.045, .1, .03, 'triangle'));
      if (kind === 'start') [330,440,660].forEach((f,i) => tone(f, at + i*.09, .18));
      if (kind === 'results') [392,494,587,784].forEach((f,i) => tone(f, at + i*.11, .3));
    }
  };
}
