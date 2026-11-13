import { createScanner } from '/scanner.js';
import { connectEvents } from '/transport.js';
import { galleryView, stationView, helpView, icon, targets as art } from '/views.js';
import { createSound } from '/sound.js';
import { createScene } from '/scene.js';
import { scoreMultiplier } from '/encounters.js';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = location.pathname.match(/^\/scan\/(green|red)$/)?.[1];
const role = color ? 'station' : 'gallery';
const socket = connectEvents({ role, ...(color ? { color } : {}) });
let state, connected = false, synced = false, armed = false, simulatedLast = null, seq = 0;
let nameDirty = false, noticeTimer, lastBoard = '', lastRound = null;
let lastBanner = '', lastPresenceView = '', previousPhase = null, scene;
const sound = createSound();
const modeNames = { simultaneous: 'Head-to-head', alternating: 'Take turns', single: 'Solo run' };
$('help-dialog').innerHTML = helpView();
$('how-to').innerHTML = icon('help') + '<span>How to play</span>';
$('how-to').onclick = () => { $('help-dialog').showModal(); if (role === 'station') { updateCapture(); sendPresence(); } };
$('help-dialog').addEventListener('close', () => { if (role === 'station') { updateCapture(); sendPresence(); } });
$('close-help').onclick = () => $('help-dialog').close();
$('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } });
$('sound').innerHTML = icon('mute') + '<span>Sound off</span>';
$('sound').onclick = () => { const on = sound.toggle(); $('sound').setAttribute('aria-pressed', String(on)); $('sound').setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on'); $('sound').innerHTML = icon(on ? 'sound' : 'mute') + `<span>Sound ${on ? 'on' : 'off'}</span>`; if (on) sound.play('hit'); };
$('fullscreen').innerHTML = icon('expand') + '<span>Full screen</span>';
document.querySelector('.brand-mark').innerHTML = icon('snow');
document.addEventListener('fullscreenchange', () => { $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Full screen'); $('fullscreen').innerHTML = icon('expand') + `<span>${document.fullscreenElement ? 'Exit full screen' : 'Full screen'}</span>`; });
const randomId = () => [...crypto.getRandomValues(new Uint32Array(4))].map(n => n.toString(16)).join('-');
const instanceId = randomId(); // Works on LAN HTTP without crypto.randomUUID's secure-context restriction.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let serverAtSync = Date.now(), monoAtSync = performance.now();
const serverNow = () => serverAtSync + performance.now() - monoAtSync;
const notify = message => { $('notice').textContent = message; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('notice').textContent = ''; }, 6500); };
const emitAck = (event, data, done) => {
  if (!connected || !synced) return notify('Disconnected. Wait for the connection to recover.');
  socket.timeout(3000).emit(event, data, (error, result) => {
    if (error) return notify('No confirmation. Check the connection and current state.');
    if (result?.error) return notify(result.error);
    done?.(result);
  });
};
$('fullscreen').onclick = () => {
  const attempt = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  attempt?.catch(() => notify('Full screen is unavailable in this browser.'));
};
if (role === 'gallery') {
  document.body.dataset.phase = 'lobby';
  document.body.classList.add('gallery-page');
  $('app').innerHTML = galleryView();
  scene = createScene({ reducedMotion, onSafe: () => sound.play('safe') });
  $('camp').hidden = false;
  $('camp').onclick = () => $('setup-dialog').showModal();
  $('close-setup').onclick = () => $('setup-dialog').close();
  document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => { $('mode').value = button.dataset.mode; updateMode(); });
  $('mode').onchange = updateMode;
  $('banner').addEventListener('click', event => {
    if (event.target.closest('[data-next]')) emitAck('control', { action: 'reset' });
    if (event.target.closest('[data-setup]')) $('setup-dialog').showModal();
  });
  $('setup-form').onsubmit = event => {
    event.preventDefault(); emitAck('control', { action: 'start', mode: $('mode').value, singleColor: $('chosen-color').value, firstColor: $('chosen-color').value,
      names: { green: $('name-green').value.trim(), red: $('name-red').value.trim() } });
  };
  for (const c of ['green','red']) $('name-' + c).oninput = () => { $('name-' + c).dataset.dirty = 'true'; };
  $('finish').onclick = () => emitAck('control', { action: 'finish' });
  $('reset').onclick = () => emitAck('control', { action: 'reset' });
  $('retry-save').onclick = () => emitAck('control', { action: 'retrySave' });
  $('board-mode').onchange = () => renderBoard(true);
  $('chosen-color').onchange = updateMode;
} else {
  document.body.classList.add('scanner-page');
  document.body.dataset.scanner = color;
  $('app').innerHTML = stationView(color);
  $('name-form').onsubmit = event => { event.preventDefault(); emitAck('name', { name: $('player-name').value }, () => { nameDirty = false; notify('Name saved.'); }); };
  $('player-name').oninput = () => { nameDirty = true; };
  $('arm').onclick = () => { document.activeElement?.blur(); armed = true; scanner.reset(); updateCapture(); sendPresence(); };
  document.querySelectorAll('[data-sim]').forEach(button => button.onclick = () => submit(button.dataset.sim, performance.now(), true));
  $('duplicate').onclick = () => { if (simulatedLast) sendShot(simulatedLast, performance.now()); };
  const scanner = createScanner((payload, at) => submit(payload, at));
  document.addEventListener('keydown', event => {
    if (event.target.closest('input,select,textarea,[contenteditable=true]')) return;
    if (!armed || !document.hasFocus() || $('help-dialog').open) return;
    if ($('simulator').open && ['1','4','s','S','d','D'].includes(event.key) && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); submit(({ '1':'SNOW', '4':'GIFT', s:'SANTA', S:'SANTA', d:'DEER', D:'DEER' })[event.key], performance.now(), true); return;
    }
    scanner(event);
  });
  const focusChanged = () => { scanner.reset(); updateCapture(); sendPresence(); };
  window.addEventListener('focus', focusChanged); window.addEventListener('blur', focusChanged);
  document.addEventListener('visibilitychange', focusChanged);
  document.addEventListener('focusin', () => { scanner.reset(); updateCapture(); sendPresence(); });
  document.addEventListener('focusout', () => queueMicrotask(() => { updateCapture(); sendPresence(); }));
}
function canCapture() { return armed && !$('help-dialog').open && document.hasFocus() && !document.hidden && !document.activeElement?.matches('input,select,textarea,[contenteditable=true]'); }
function sendPresence() { if (role === 'station' && connected) socket.emit('presence', { focused: document.hasFocus() && !document.hidden, armed: canCapture() }); }
function updateCapture() {
  if (role !== 'station') return;
  const ready = canCapture() && connected && synced;
  $('capture-status').textContent = !connected ? 'Disconnected — scans discarded' : !synced ? 'Synchronizing…' : !document.hasFocus() || document.hidden ? 'Window inactive — click here to capture' : $('help-dialog').open ? 'Instructions open — close to resume capture' : document.activeElement?.matches('input,select,textarea,[contenteditable=true]') ? 'Editing a field — click Arm when finished' : !armed ? 'Click to arm capture' : 'Capture ready · scan a target';
  $('capture-box').classList.toggle('warning', !ready);
  $('arm').innerHTML = ready ? icon('check') + 'Capture is armed' : 'Arm scanner capture ' + icon('arrow');
  $('arm').setAttribute('aria-label', ready ? 'Re-arm scanner capture' : 'Arm scanner capture');
}
function submit(payload, at, simulated = false) {
  if (!connected || !synced || !state) { $('last-scan').textContent = 'Disconnected — scan discarded.'; return; }
  if (!simulated && !canCapture()) { $('last-scan').textContent = 'Capture is not armed.'; return; }
  const target = state.targets.find(t => t.code === payload);
  const shot = { payload, roundId: state.roundId, spawnId: target?.spawnId, eventId: `${instanceId}-${++seq}` };
  simulatedLast = shot; sendShot(shot, at);
}
function sendShot(shot, at) {
  if (!connected || !synced) return;
  $('last-scan').textContent = `${shot.payload} · sending…`;
  // volatile prevents the connection from buffering a shot across a lost connection.
  socket.timeout(1500).volatile.emit('scan', shot, (error, result) => {
    if (error) { $('last-scan').textContent = `${shot.payload} · unconfirmed; check the TV.`; return; }
    const elapsed = performance.now() - at;
    $('last-scan').textContent = result.duplicate ? `${shot.payload} · duplicate delivery, no extra damage.` : result.accepted ? result.kind === 'penalty' ? `${shot.payload} · hold fire · ${result.points} points · streak reset` : `${shot.payload} · hit! +${result.points} · ×${result.multiplier} · score ${result.score}` : `${shot.payload} · ${result.reason}`;
    $('scan-diagnostic').textContent = `Enter/click → acknowledgement ${elapsed.toFixed(1)} ms · server handler ${result.serverProcessMs?.toFixed(2)} ms`;
  });
}
function updateMode() {
  if (role !== 'gallery') return;
  const mode = $('mode').value;
  document.querySelectorAll('[data-mode]').forEach(button => { const active = button.dataset.mode === mode; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
  $('color-choice-label').hidden = mode === 'simultaneous';
  $('color-choice-copy').textContent = mode === 'single' ? 'Your scanner' : 'Who goes first?';
  $('mode-note').textContent = mode === 'single' ? 'One player. Two-minute round.' : mode === 'alternating' ? 'Scanners alternate every 15 seconds.' : 'Both players race for the same one-scan targets.';
  for (const c of ['green','red']) { const inactive = mode === 'single' && c !== $('chosen-color').value; $('name-'+c).disabled = inactive; $('name-'+c).closest('label').classList.toggle('inactive', inactive); }
}
function renderBoard(force = false) {
  if (role !== 'gallery' || !state) return;
  const mode = $('board-mode').value;
  const rows = state.leaderboard.filter(r => mode === 'all' || r.mode === mode).slice(0,8);
  const key = JSON.stringify(rows); if (!force && key === lastBoard) return; lastBoard = key;
  $('board').innerHTML = rows.map((r,i) => `<tr><td><span class="rank rank-${i+1}">${String(i+1).padStart(2,'0')}</span></td><td><span class="hunter-name"><i class="hunter-dot ${r.color}"></i>${escape(r.name)}</span><small>${escape(modeNames[r.mode] || r.mode)} · ${escape(r.endedAt.slice(0,10))}</small></td><td><strong>${r.score.toLocaleString()}</strong></td></tr>`).join('') || `<tr><td colspan="3" class="empty-board">${icon('trophy')}<strong>No scores yet.</strong><p>Complete a round to add scores.</p></td></tr>`;
}
function renderBanner() {
  $('banner').hidden = state.phase === 'playing';
  if (state.phase === 'playing') { lastBanner = ''; return; }
  const key = JSON.stringify([state.phase,state.roundId,state.players,state.mode,state.persistence]);
  if (key === lastBanner) return; lastBanner = key;
  if (state.phase === 'lobby') {
    $('banner').className = 'banner lobby-banner';
    $('banner').innerHTML = `<div class="lobby-copy"><p class="eyebrow hero-kicker">THE NORTH POLE · CHRISTMAS ’26</p><h1>Merry<br><em>Mayhem.</em></h1><p>Snowmen to clear. Presents to collect.<br>Santa and reindeer? Let them pass.</p><button type="button" data-setup class="primary hero-cta">Let’s play ${icon('arrow')}</button><div class="hero-steps"><span>Scan snowmen.</span><span>Grab gold gifts.</span><span>Save Christmas.</span></div></div><div class="hero-character" aria-hidden="true"><span class="speech-bubble">Brrr!</span><div class="sprite snowman hero-snowman"></div></div><span class="winter-location">SNOWFALL VILLAGE · TWO SCANNERS · TWO MINUTES</span>`;
  } else {
    const players = Object.values(state.players).filter(p => state.mode !== 'single' || p.color === state.singleColor).sort((a,b)=>b.score-a.score);
    const tied = players.length > 1 && players[0].score === players[1].score;
    const headline = tied ? 'Tie.' : 'Round complete.';
    $('banner').className = 'banner results-banner';
    $('banner').innerHTML = `<div class="results-copy"><p class="eyebrow">${icon('trophy')} ROUND RESULTS</p><h2>${headline}</h2><p class="winner-title">${tied ? 'Tied score.' : `${escape(players[0].name)} ${state.mode === 'single' ? 'completed the round.' : 'wins.'}`}</p><div class="result-scores">${players.map((p,i)=>`<div class="result-player ${p.color} ${i===0&&!tied?'winner':''}"><small>${escape(p.name)}</small><strong>${p.score.toLocaleString()}<span> PTS</span></strong><p>${p.kills} cleared · ${p.mistakes || 0} mistakes</p><small>Best streak: ${p.bestStreak || 0}</small></div>`).join('')}</div><button class="primary" data-next ${state.persistence!=='saved'?'disabled':''}>Next group ${icon('arrow')}</button><p class="result-note">${state.persistence==='saved'?'Scores saved.':state.persistence==='error'?'Score saving failed. Retrying automatically…':'Saving scores…'}</p></div><div class="results-mascot sprite gift" aria-hidden="true"></div>`;
  }
}
function renderPresence() {
  const key = JSON.stringify(state.presence); if (key === lastPresenceView) return; lastPresenceView = key;
  $('presence').innerHTML = ['green','red'].map(c => {
    const p = state.presence[c];
    const status = !p.connected ? 'Open & arm scanner' : p.connected > 1 ? 'Close extra capture tabs' : !p.focused ? 'Window inactive' : !p.armed ? 'Click Arm to get ready' : 'Capture ready';
    const ready = p.connected === 1 && p.focused && p.armed;
    return `<a class="station-link ${c} ${ready?'ready':''}" href="/scan/${c}" target="_blank" rel="noopener"><span class="station-link-dot"></span><span><strong>${c==='green'?'Green · East':'Red · Student Main'}</strong><small>${status}</small></span>${icon(ready?'check':'external')}</a>`;
  }).join('');
}
function render(hit) {
  if (!state) return;
  if (role === 'station') {
    if (lastRound !== state.roundId) { nameDirty = false; lastRound = state.roundId; $('last-scan').textContent = 'No scans yet.'; }
    $('name-form').hidden = state.phase !== 'lobby';
    if (!nameDirty) $('player-name').value = state.players[color].name;
    $('round-status').textContent = state.phase === 'playing' ? `${state.players[color].name || color} · ${state.players[color].score} points · ${state.mode === 'alternating' ? state.turn + "'s turn" : state.mode === 'single' ? state.singleColor + ' only' : 'Both scanners live'}` : state.phase === 'results' ? `Round complete · ${state.players[color].score} points` : 'Waiting for the gallery to start.';
    updateCapture(); return;
  }
  document.body.classList.toggle('playing', state.phase === 'playing');
  document.body.dataset.phase = state.phase;
  $('round-summary').hidden = state.phase === 'lobby';
  if (state.phase !== 'lobby' && previousPhase !== state.phase) $('round-summary').innerHTML = state.phase === 'results' ? '<h3>Round complete.</h3><p>Start a new group when everyone is ready.</p>' : '<h3>Round in progress.</h3><p>Keep the scanner windows active.</p>';
  $('setup-form').hidden = state.phase !== 'lobby'; $('finish').hidden = state.phase !== 'playing'; $('reset').hidden = state.phase !== 'results';
  $('retry-save').hidden = state.persistence !== 'error';
  $('reset').disabled = state.persistence !== 'saved';
  $('start').disabled = !connected;
  for (const c of ['green','red']) {
    const p = state.players[c]; $('' + c + '-name').textContent = p.name || (c === 'green' ? 'Green player' : 'Red player');
    $('player-' + c).classList.toggle('off-turn', state.phase === 'playing' && (state.mode === 'single' ? c !== state.singleColor : state.mode === 'alternating' && c !== state.turn)); $(c + '-score').textContent = p.score;
    $(c + '-hits').textContent = `${p.kills} cleared · ${p.mistakes || 0} mistakes`;
    $(c + '-multiplier').textContent = `×${scoreMultiplier(p.streak)}`;
    $(c + '-streak').textContent = `${p.streak || 0} streak`;
    $('player-'+c).classList.toggle('hot-streak', scoreMultiplier(p.streak) > 1);
    if (lastRound !== state.roundId || !$('name-' + c).dataset.dirty) $('name-' + c).value = p.name;
    if (lastRound !== state.roundId) delete $('name-' + c).dataset.dirty;
  }
  if (lastRound !== state.roundId) { $('mode').value = state.mode; $('chosen-color').value = state.firstColor; $('hit-feedback').textContent = 'Waiting for a scan.'; updateMode(); }
  lastRound = state.roundId;
  scene.update(state, hit);
  renderBanner();
  renderPresence();
  $('save-status').textContent = state.phase !== 'results' && state.persistence === 'saved' ? 'Scanner pages stay connected between groups.' : state.persistence === 'saved' ? 'Completed scores saved.' : state.persistence === 'saving' ? 'Saving completed scores…' : 'Score saving failed. Keep the server running; retrying automatically.';
  if (hit) {
    $('hit-feedback').textContent = hit.kind === 'penalty' ? `${state.players[hit.color].name} · hold fire · ${hit.points} points · streak reset` : `${state.players[hit.color].name} · +${hit.points} · ${art[hit.code].name} · ×${hit.multiplier}`;
    const player = $('player-'+hit.color); clearTimeout(player.scoreTimer); player.classList.add('scored'); player.classList.toggle('mistake', hit.kind === 'penalty'); player.scoreTimer = setTimeout(() => player.classList.remove('scored','mistake'), 400);
  }
  renderBoard();
  if (previousPhase !== state.phase) {
    if (state.phase === 'playing' || state.phase === 'results') $('setup-dialog').close();
    else if (previousPhase === 'results') $('setup-dialog').showModal();
    if (state.phase === 'playing') document.querySelector('.arena').focus({ preventScroll: true });
  }
  if (previousPhase && previousPhase !== state.phase) sound.play(state.phase === 'playing' ? 'start' : state.phase === 'results' ? 'results' : '');
  if (hit) sound.play(hit.kind === 'penalty' ? 'penalty' : 'clear', hit.multiplier);
  previousPhase = state.phase;
}
socket.on('connect', () => { connected = true; scene?.connection(false); $('connection').textContent = 'Connected'; $('connection').className = 'badge'; updateCapture(); sendPresence(); });
socket.on('disconnect', () => { connected = false; synced = false; scene?.connection(false); $('connection').textContent = 'Disconnected'; $('connection').className = 'badge warning'; updateCapture(); if (role === 'gallery') $('start').disabled = true; });
socket.on('connect_error', error => { $('connection').textContent = 'Connection issue'; $('connection').className = 'badge warning'; updateCapture(); console.warn(error.message); });
socket.on('state', packet => {
  const received = performance.now();
  state = packet.state; synced = true; scene?.connection(connected); serverAtSync = state.serverNow; monoAtSync = received;
  render(packet.hit);
  if (role === 'station') sendPresenceIfNeeded();
  if (packet.hit && role === 'gallery') {
    const domMs = performance.now() - received;
    requestAnimationFrame(() => {
      const frameWaitMs = performance.now() - received;
      socket.volatile.emit('display:frame', { traceId: packet.hit.traceId, domMs, frameWaitMs });
    });
    $('diagnostic').textContent = `Server handler ${packet.hit.serverProcessMs.toFixed(2)} ms · TV DOM ${domMs.toFixed(2)} ms · frame pending…`;
  }
});
let lastPresence = '';
function sendPresenceIfNeeded() {
  const key = `${connected}:${canCapture()}:${document.hasFocus()}`;
  if (key !== lastPresence) { lastPresence = key; sendPresence(); }
}
socket.on('diagnostic', metric => {
  $('diagnostic').textContent = `TV DOM ${metric.domMs.toFixed(2)} ms · receipt → rAF ${metric.frameWaitMs.toFixed(1)} ms · server receipt → TV rAF → server ${metric.serverToFrameReturnMs.toFixed(1)} ms`;
});
function animate() {
  if (state && role === 'gallery') {
    const now = serverNow(); const ms = state.phase === 'lobby' ? 120000 : state.phase === 'playing' ? Math.max(0,state.endsAt-now) : 0;
    const seconds = Math.ceil(ms / 1000); $('clock').textContent = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    $('phase').textContent = state.phase === 'playing' ? state.mode === 'alternating' ? `${state.turn?.toUpperCase()} TURN · ${Math.ceil((state.turnMs-(now-state.startedAt)%state.turnMs)/1000)}s` : state.mode === 'single' ? `${state.singleColor.toUpperCase()} ONLY` : 'BOTH SCANNERS LIVE' : state.phase === 'results' ? 'ROUND COMPLETE' : 'PREPARE A GROUP';
    $('timer-fill').style.transform = `scaleX(${ms / 120000})`;
    document.querySelector('.clock').classList.toggle('urgent', state.phase === 'playing' && seconds <= 15);
    scene.frame(now);
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);


