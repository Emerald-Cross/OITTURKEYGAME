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
    play(kind, multiplier = 1) {
      if (!enabled || context?.state !== 'running') return;
      const at = context.currentTime;
      if (kind === 'hit') { tone(400, at, .06, .03, 'triangle'); tone(230, at + .025, .09, .025, 'triangle'); }
      if (kind === 'clear') {
        tone(120, at, .12, .08, 'triangle');
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .11), context.sampleRate), samples = buffer.getChannelData(0);
        for (let i=0;i<samples.length;i++) samples[i] = (Math.random()*2-1) * (1-i/samples.length) ** 2;
        const noise = context.createBufferSource(), filter = context.createBiquadFilter(), volume = context.createGain();
        noise.buffer = buffer; filter.type = 'highpass'; filter.frequency.value = 1000; volume.gain.value = .14;
        noise.connect(filter).connect(volume).connect(context.destination); noise.start(at);
        [660,990].forEach((f,i) => tone(f * (1 + (multiplier-1)*.15), at + .04 + i*.04, .12, .045, 'triangle'));
      }
      if (kind === 'penalty') { tone(150, at, .13, .045, 'triangle'); tone(95, at+.08, .15, .04, 'triangle'); }
      if (kind === 'safe') tone(760, at, .08, .018);
      if (kind === 'start') [330,440,660].forEach((f,i) => tone(f, at + i*.09, .18));
      if (kind === 'results') [392,494,587,784].forEach((f,i) => tone(f, at + i*.11, .3));
    }
  };
}
