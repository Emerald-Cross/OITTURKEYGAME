// Adapted from ghostpatrolmk1/public/scanner.js at e3606df.
// One callback per terminating Enter; no debounce or cooldown between shots.
export function createScanner(onScan, clock = () => performance.now()) {
  let buffer = '', last = 0;
  const capture = event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) { buffer = ''; return; }
    const now = clock();
    if (now - last > 1000) buffer = '';
    last = now;
    if (event.key === 'Enter') {
      const payload = buffer.trim().toUpperCase(); buffer = ''; event.preventDefault?.();
      if (payload) onScan(payload, now);
    } else if (event.key.length === 1 && !event.repeat) {
      buffer += event.key;
      if (buffer.length > 32) buffer = '';
    }
  };
  capture.reset = () => { buffer = ''; last = 0; };
  return capture;
}
