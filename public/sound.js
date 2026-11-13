// Optional synthesized sleigh bells and snow puffs; no sound before a gesture.
export function createSound() {
  let context, enabled = false;
  const tone = (frequency, start, length, gain = .035, type = 'sine') => {
    const oscillator = context.createOscillator(), volume = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(0, start); volume.gain.linearRampToValueAtTime(gain, start + .006);
    volume.gain.exponentialRampToValueAtTime(.001, start + length);
    oscillator.connect(volume).connect(context.destination); oscillator.start(start); oscillator.stop(start + length + .01);
  };
  const bell = (frequency, start, gain = .035) => {
    tone(frequency, start, .3, gain);
    tone(frequency * 2.76, start, .16, gain * .28);
    tone(frequency * 4.07, start, .08, gain * .12);
  };
  return {
    toggle() {
      try {
        if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
        if (context.state === 'suspended') context.resume().catch(() => {});
        enabled = !enabled; return enabled;
      } catch { enabled = false; return false; }
    },
    play(kind, multiplier = 1) {
      if (!enabled || context?.state !== 'running') return;
      const at = context.currentTime;
      if (kind === 'hit') bell(988, at, .025);
      if (kind === 'clear') {
        tone(145, at, .1, .05, 'triangle');
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .1), context.sampleRate), samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 2;
        const noise = context.createBufferSource(), filter = context.createBiquadFilter(), volume = context.createGain();
        noise.buffer = buffer; filter.type = 'highpass'; filter.frequency.value = 1400; volume.gain.value = .12;
        noise.connect(filter).connect(volume).connect(context.destination); noise.start(at);
        [784,1175,1568].forEach((f,i) => bell(f * (1 + (multiplier - 1) * .12), at + .035 + i * .045, .032));
      }
      if (kind === 'penalty') { tone(185, at, .14, .035, 'triangle'); tone(123, at + .08, .16, .03, 'triangle'); }
      if (kind === 'safe') bell(1047, at, .015);
      if (kind === 'start') [659,784,1047].forEach((f,i) => bell(f, at + i * .1));
      if (kind === 'results') [784,988,1175,1568].forEach((f,i) => bell(f, at + i * .13));
    }
  };
}

