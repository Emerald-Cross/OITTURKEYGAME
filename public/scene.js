import { encounterPose, CLEAR_MS } from '/encounters.js';
import { targets } from '/views.js';

export function createScene({ reducedMotion = false, onSafe = () => {} } = {}) {
  const $ = id => document.getElementById(id);
  const creature = $('creature'), patch = $('scan-patch'), image = $('animal-code');
  let snapshot, connection = false, appearance = '', loadedCode = '', lastPhase = '', lastOutcome = '', hitTimer;
  image.onload = () => { loadedCode = image.getAttribute('src'); };
  image.onerror = () => { loadedCode = ''; patch.hidden = true; };
  return {
    connection(connected) { connection = connected; if (!connected) patch.hidden = true; },
    update(state, hit) {
      snapshot = state;
      const encounter = state.encounter, target = state.targets.find(t => t.code === encounter?.code);
      if (!encounter || !target || state.phase !== 'playing') {
        creature.hidden = true; patch.hidden = true; $('encounter-info').hidden = true; $('encounter-cue').textContent = ''; return;
      }
      const art = targets[target.code];
      creature.hidden = false;
      if (appearance !== encounter.id) {
        appearance = encounter.id; lastPhase = ''; lastOutcome = '';
        creature.dataset.code = target.code; creature.dataset.spawn = target.spawnId;
        creature.dataset.action = target.action;
        creature.classList.remove('hit', 'cleared-hit', 'mistake', 'safe', 'escaped'); $('damage').hidden = true;
        creature.classList.toggle('golden', target.code === 'TKY4');
        document.querySelector('.arena').classList.remove('mistake');
        clearTimeout(hitTimer);
        $('animal-art').className = `animal sprite ${art.art}`;
        creature.setAttribute('aria-label', target.action === 'shoot' ? `${art.name}, one scan, ${target.points} base points` : `${art.name}, hold fire, ${target.penalty} point penalty for scanning`);
        const src = `/qr/${target.code}.svg`;
        if (image.getAttribute('src') !== src) { loadedCode = ''; patch.hidden = true; image.src = src; }
        image.alt = target.action === 'shoot' ? `Scan the patch on ${art.name}` : `Code on ${art.name}. Hold fire.`;
        $('animal-name').textContent = art.name;
        $('animal-health').textContent = target.action === 'shoot' ? 'SCAN' : 'HOLD FIRE';
        $('animal-points').textContent = target.action === 'shoot' ? `+${target.points} × your multiplier` : `−${target.penalty} for scanning · streak resets`;
      }
      creature.dataset.hp = target.hp;
      // Apply authoritative visibility synchronously, before any animation frame.
      if (!target.active) patch.hidden = true;
      if (hit && hit.code === target.code) {
        const mistake = hit.kind === 'penalty';
        creature.style.setProperty('--hit', mistake ? '#ffc3a2' : hit.color === 'green' ? '#d5f39a' : '#ffc3a2');
        clearTimeout(hitTimer); creature.classList.remove('hit', 'cleared-hit', 'mistake', 'safe', 'escaped');
        creature.querySelectorAll('.impact-feathers, .damage, .animal').forEach(node => node.getAnimations().forEach(animation => animation.cancel()));
        creature.classList.add(mistake ? 'mistake' : 'hit'); creature.classList.toggle('cleared-hit', hit.killed);
        document.querySelector('.arena').classList.toggle('mistake', mistake);
        $('damage').textContent = mistake ? hit.points < 0 ? `−${-hit.points}` : 'HOLD FIRE' : `+${hit.points}`;
        $('damage').hidden = false;
        hitTimer = setTimeout(() => { creature.classList.remove('hit', 'cleared-hit', 'mistake'); document.querySelector('.arena').classList.remove('mistake'); $('damage').hidden = true; }, mistake ? 400 : CLEAR_MS);
      }
      if (encounter.outcome && encounter.outcome !== lastOutcome) {
        lastOutcome = encounter.outcome;
        if (lastOutcome === 'safe') {
          creature.classList.add('safe'); $('damage').textContent = '✓'; $('damage').hidden = false; onSafe();
        } else if (lastOutcome === 'escaped' && target.action === 'shoot') {
          creature.classList.add('escaped'); $('damage').textContent = 'ESCAPED'; $('damage').hidden = false;
        }
      }
      this.frame(state.serverNow);
    },
    frame(now) {
      if (!snapshot || snapshot.phase !== 'playing' || !snapshot.encounter) return;
      const encounter = snapshot.encounter, pose = encounterPose(encounter, now, reducedMotion);
      const target = snapshot.targets.find(t => t.code === encounter.code);
      const canScan = connection && target.active && pose.phase === 'reveal' && loadedCode === `/qr/${target.code}.svg`;
      patch.hidden = !canScan;
      creature.dataset.stage = pose.phase;
      creature.style.left = `${pose.x}%`;
      creature.style.bottom = `${pose.floor}%`;
      creature.style.transform = reducedMotion ? 'translateX(-50%)' : `translate3d(-50%,${pose.bob}px,${pose.z}px) rotateY(${pose.yaw}deg)`;
      creature.style.opacity = pose.opacity;
      $('encounter-info').hidden = !canScan;
      if (lastPhase !== pose.phase) {
        lastPhase = pose.phase;
        $('encounter-cue').textContent = pose.phase === 'quiet' || pose.phase === 'cleared' ? '' : targets[target.code].call;
        $('encounter-tag').textContent = target.action === 'avoid' ? 'PROTECTED WILDLIFE' : target.code === 'TKY4' ? 'BONUS TARGET' : 'TARGET';
      }
      $('window-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, (encounter.concealAt - now) / (encounter.concealAt - encounter.revealAt)))})`;
    }
  };
}
