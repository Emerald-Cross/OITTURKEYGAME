import { encounterPose } from '/encounters.js';
import { targets } from '/views.js';

export function createScene({ reducedMotion = false } = {}) {
  const $ = id => document.getElementById(id);
  const creature = $('creature'), patch = $('scan-patch'), image = $('animal-code');
  const cues = { approach: 'Something’s moving in the trees…', peek: 'Oh, we see you.', dodge: 'Sneaky little gobbler.',
    reveal: 'Now’s your chance.', retreat: 'Back into the bushes.', cleared: 'That’ll ruffle some feathers.', quiet: 'Keep an eye on the clearing…' };
  let snapshot, connection = false, appearance = '', loadedCode = '', lastPhase = '', lastHp = '', hitTimer;
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
        appearance = encounter.id; lastPhase = ''; lastHp = '';
        creature.dataset.code = target.code; creature.dataset.spawn = target.spawnId;
        creature.classList.remove('hit', 'cleared-hit'); $('damage').hidden = true;
        clearTimeout(hitTimer);
        $('animal-art').className = `animal sprite ${art.art}`;
        creature.setAttribute('aria-label', `${art.name}, ${target.hp} hits remaining, ${target.points} points per hit`);
        const src = `/qr/${target.code}.svg`;
        if (image.getAttribute('src') !== src) { loadedCode = ''; patch.hidden = true; image.src = src; }
        image.alt = `Scan the patch on ${art.name}`;
        $('animal-name').textContent = art.name;
      }
      const hp = `${target.code}:${target.hp}`;
      creature.dataset.hp = target.hp;
      if (lastHp !== hp) {
        lastHp = hp;
        creature.setAttribute('aria-label', `${art.name}, ${target.hp} hits remaining, ${target.points} points per hit`);
        $('animal-health').innerHTML = Array.from({ length: target.maxHp }, (_, i) => `<i class="${i < target.hp ? 'full' : ''}"></i>`).join('');
        $('animal-health').setAttribute('aria-label', `${target.hp} of ${target.maxHp} health remaining`);
        $('animal-points').textContent = `${target.hp} ${target.hp === 1 ? 'hit' : 'hits'} left · +${target.points} per hit`;
      }
      // Apply authoritative visibility synchronously, before any animation frame.
      if (!target.active) patch.hidden = true;
      if (hit && hit.code === target.code) {
        creature.style.setProperty('--hit', hit.color === 'green' ? '#d5f39a' : '#ffc3a2');
        clearTimeout(hitTimer); creature.classList.remove('hit', 'cleared-hit');
        creature.querySelectorAll('.impact-feathers, .damage, .animal').forEach(node => node.getAnimations().forEach(animation => animation.cancel()));
        creature.classList.add('hit'); creature.classList.toggle('cleared-hit', hit.killed);
        $('damage').textContent = `+${hit.points}`; $('damage').hidden = false;
        hitTimer = setTimeout(() => { creature.classList.remove('hit', 'cleared-hit'); $('damage').hidden = true; }, 750);
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
      creature.style.setProperty('--cover', `${pose.cover * 100}%`);
      $('encounter-info').hidden = !canScan;
      if (lastPhase !== pose.phase) {
        lastPhase = pose.phase;
        $('encounter-cue').textContent = cues[pose.phase];
        $('encounter-tag').textContent = target.code === 'BEAR' ? 'A SLIGHT CHANGE OF PLANS' : target.hp < target.maxHp ? 'BACK FOR ANOTHER ROUND' : 'OUT OF THE WOODS';
      }
      $('window-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, (encounter.concealAt - now) / (encounter.concealAt - encounter.revealAt)))})`;
    }
  };
}
