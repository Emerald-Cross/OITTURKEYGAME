import { createScanner } from '/scanner.js';
import { connectEvents } from '/transport.js';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = location.pathname.match(/^\/scan\/(green|red)$/)?.[1];
const role = color ? 'station' : 'gallery';
const socket = connectEvents({ role, ...(color ? { color } : {}) });
let state, connected = false, synced = false, armed = false, simulatedLast = null, seq = 0;
let nameDirty = false, noticeTimer, lastBoard = '', lastRound = null;
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
  $('app').innerHTML = `
    <section class="hud" aria-label="Live scores">
      <div class="player green"><div><small>GREEN · <span id="green-name">Player</span></small><strong id="green-score">0</strong></div><small id="green-hits">0 hits</small></div>
      <div class="clock"><strong id="clock">02:00</strong><small id="phase">PREPARE A GROUP</small></div>
      <div class="player red"><small id="red-hits">0 hits</small><div><small>RED · <span id="red-name">Player</span></small><strong id="red-score">0</strong></div></div>
    </section>
    <section class="gallery" aria-label="Shooting gallery">
      ${['TKY1','TKY4','BEAR'].map(code => `<article class="target" data-code="${code}" id="target-${code}"><div class="animal" aria-hidden="true">${code === 'BEAR' ? '🐻' : '🦃'}</div><div class="card"><span class="damage" hidden></span><img src="/qr/${code}.svg" alt="Scan target ${code}" draggable="false"><div class="health" aria-label="Target health"></div><div class="label"><span>${code}</span><span class="points"></span></div></div></article>`).join('')}
      <div class="mob" aria-hidden="true">🐿️<span>JUST PASSING THROUGH</span></div><div class="mob second" aria-hidden="true">🦌<span>JUST PASSING THROUGH</span></div>
      <div id="banner" class="banner"><p class="eyebrow">TWO SCANNERS. TWO MINUTES.</p><h2>Turkey Shoot</h2><p>Enter names below, open each scanner page, and start a round.</p></div>
    </section>
    <div id="hit-feedback" class="feedback" aria-live="polite">Ready when you are.</div>
    <div class="below"><section class="panel"><h2>Round controls</h2>
      <form id="setup-form"><div class="row"><label>Green player<input id="name-green" maxlength="24" placeholder="Player name" autocomplete="off"></label><label>Red player<input id="name-red" maxlength="24" placeholder="Player name" autocomplete="off"></label></div>
      <div class="row"><label>Play mode<select id="mode"><option value="simultaneous">Together · simultaneous</option><option value="alternating">Take turns · 15 seconds each</option><option value="single">Single player</option></select></label><label id="color-choice-label">First turn / single scanner<select id="chosen-color"><option value="green">Green</option><option value="red">Red</option></select></label></div><button id="start" type="submit">Start 2-minute round</button></form>
      <div class="row"><button id="finish" class="quiet" hidden>End round</button><button id="reset" hidden>Next group</button><button id="retry-save" class="quiet" hidden>Retry score save</button></div>
      <div id="presence" class="presence"></div><div class="links"><a href="/scan/green" target="_blank" rel="noopener">Green scanner · East ↗</a><a href="/scan/red" target="_blank" rel="noopener">Red scanner · Student Main ↗</a></div>
      <p id="save-status" class="muted"></p><details><summary>Timing & setup notes</summary><div id="diagnostic" class="diag">Waiting for a hit…</div><p class="muted">Timing measures software only. The frame callback is a scheduling proxy; it does not measure optical decoding, physical paint, cable or TV delay. Keep each capture browser focused. One active capture tab per scanner.</p><p class="muted">Each hit earns points: TKY1 = 10 (1 HP), TKY4 = 25 (4 HP), BEAR = 40 (6 HP). Targets return 1.8 seconds after defeat. Squirrels and deer have no codes.</p></details>
      </section><section class="panel"><div class="row"><h2>All-time leaderboard</h2><label>Mode<select id="board-mode"><option value="all">All modes</option><option value="simultaneous">Together</option><option value="alternating">Alternating</option><option value="single">Single player</option></select></label></div><table><thead><tr><th>#</th><th>Player / mode</th><th>Points</th></tr></thead><tbody id="board"></tbody></table><p class="muted">Completed rounds · best 50 scores · saved on the host.</p></section></div>`;
  $('setup-form').onsubmit = event => {
    event.preventDefault(); emitAck('control', { action: 'start', mode: $('mode').value, singleColor: $('chosen-color').value, firstColor: $('chosen-color').value,
      names: { green: $('name-green').value.trim(), red: $('name-red').value.trim() } });
  };
  for (const c of ['green','red']) $('name-' + c).oninput = () => { $('name-' + c).dataset.dirty = 'true'; };
  $('finish').onclick = () => emitAck('control', { action: 'finish' });
  $('reset').onclick = () => emitAck('control', { action: 'reset' });
  $('retry-save').onclick = () => emitAck('control', { action: 'retrySave' });
  $('board-mode').onchange = () => renderBoard(true);
} else {
  document.body.classList.add('scanner-page');
  $('app').innerHTML = `<section class="station"><div class="station-top ${color}"><div class="color-dot"></div><div><p class="eyebrow">${color === 'green' ? 'EAST COMPUTER' : 'STUDENT MAIN COMPUTER'}</p><h1>${color[0].toUpperCase() + color.slice(1)} scanner</h1><p>Keep this browser window active.</p></div></div>
    <form id="name-form" class="panel"><label>Your player name<input id="player-name" maxlength="24" placeholder="Enter your name" autocomplete="off"></label><button>Save name</button></form>
    <section id="capture-box" class="capture-box warning"><h2 id="capture-status">Click to arm capture</h2><p id="round-status">Waiting for the gallery…</p><button id="arm">Arm scanner capture</button><div id="last-scan" role="status" aria-live="polite">No scans yet.</div><div id="scan-diagnostic" class="diag"></div></section>
    <details id="simulator" class="panel"><summary>Test without a scanner</summary><p>Buttons use the same submission path. During a round, keyboard shortcuts 1, 4, B simulate TKY1, TKY4, BEAR.</p><div class="sim-grid">${['TKY1','TKY4','BEAR'].map(code => `<button type="button" data-sim="${code}">Scan ${code}</button>`).join('')}<button id="duplicate" class="quiet">Repeat last network delivery</button></div></details>
    <p class="muted">Scanner keyboard output must end with Enter / carriage return. Shots taken while disconnected are discarded. Unconfirmed shots are never automatically replayed. If a shot is unconfirmed, check the TV before scanning again.</p><a href="/gallery" target="_blank" rel="noopener">Open gallery ↗</a></section>`;
  $('name-form').onsubmit = event => { event.preventDefault(); emitAck('name', { name: $('player-name').value }, () => { nameDirty = false; notify('Name saved.'); }); };
  $('player-name').oninput = () => { nameDirty = true; };
  $('arm').onclick = () => { document.activeElement?.blur(); armed = true; scanner.reset(); updateCapture(); sendPresence(); };
  document.querySelectorAll('[data-sim]').forEach(button => button.onclick = () => submit(button.dataset.sim, performance.now(), true));
  $('duplicate').onclick = () => { if (simulatedLast) sendShot(simulatedLast, performance.now()); };
  const scanner = createScanner((payload, at) => submit(payload, at));
  document.addEventListener('keydown', event => {
    if (event.target.closest('input,select,textarea,[contenteditable=true]')) return;
    if (!armed || !document.hasFocus()) return;
    if ($('simulator').open && ['1','4','b','B'].includes(event.key) && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); submit(({ '1':'TKY1', '4':'TKY4', b:'BEAR', B:'BEAR' })[event.key], performance.now(), true); return;
    }
    scanner(event);
  });
  const focusChanged = () => { scanner.reset(); updateCapture(); sendPresence(); };
  window.addEventListener('focus', focusChanged); window.addEventListener('blur', focusChanged);
  document.addEventListener('visibilitychange', focusChanged);
  document.addEventListener('focusin', () => { scanner.reset(); updateCapture(); sendPresence(); });
  document.addEventListener('focusout', () => queueMicrotask(() => { updateCapture(); sendPresence(); }));
}
function canCapture() { return armed && document.hasFocus() && !document.hidden && !document.activeElement?.matches('input,select,textarea,[contenteditable=true]'); }
function sendPresence() { if (role === 'station' && connected) socket.emit('presence', { focused: document.hasFocus() && !document.hidden, armed: canCapture() }); }
function updateCapture() {
  if (role !== 'station') return;
  const ready = canCapture() && connected && synced;
  $('capture-status').textContent = !connected ? 'Disconnected — scans discarded' : !synced ? 'Synchronizing…' : !document.hasFocus() || document.hidden ? 'Window inactive — click here to capture' : document.activeElement?.matches('input,select,textarea,[contenteditable=true]') ? 'Editing a field — click Arm when finished' : !armed ? 'Click to arm capture' : 'Capture ready · scan a target';
  $('capture-box').classList.toggle('warning', !ready);
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
    $('last-scan').textContent = result.duplicate ? `${shot.payload} · duplicate delivery, no extra damage.` : result.accepted ? `${shot.payload} · hit! +${result.points} · score ${result.score}` : `${shot.payload} · ${result.reason}`;
    $('scan-diagnostic').textContent = `Enter/click → acknowledgement ${elapsed.toFixed(1)} ms · server handler ${result.serverProcessMs?.toFixed(2)} ms`;
  });
}
function renderBoard(force = false) {
  if (role !== 'gallery' || !state) return;
  const mode = $('board-mode').value;
  const rows = state.leaderboard.filter(r => mode === 'all' || r.mode === mode).slice(0,8);
  const key = JSON.stringify(rows); if (!force && key === lastBoard) return; lastBoard = key;
  $('board').innerHTML = rows.map((r,i) => `<tr><td>${i+1}</td><td><span class="${r.color}">${escape(r.name)}</span><br><small>${escape(r.mode)} · ${escape(r.endedAt.slice(0,10))}</small></td><td><strong>${r.score}</strong></td></tr>`).join('') || '<tr><td colspan="3">Finish a round to post the first score.</td></tr>';
}
function render(hit) {
  if (!state) return;
  if (role === 'station') {
    $('name-form').hidden = state.phase !== 'lobby';
    if (!nameDirty) $('player-name').value = state.players[color].name;
    $('round-status').textContent = state.phase === 'playing' ? `${state.players[color].name || color} · ${state.players[color].score} points · ${state.mode === 'alternating' ? state.turn + "'s turn" : state.mode === 'single' ? state.singleColor + ' only' : 'Both scanners live'}` : state.phase === 'results' ? `Round complete · ${state.players[color].score} points` : 'Waiting for the gallery to start.';
    updateCapture(); return;
  }
  document.body.classList.toggle('playing', state.phase === 'playing');
  $('setup-form').hidden = state.phase !== 'lobby'; $('finish').hidden = state.phase !== 'playing'; $('reset').hidden = state.phase !== 'results';
  $('retry-save').hidden = state.persistence !== 'error';
  $('reset').disabled = state.persistence !== 'saved';
  $('start').disabled = !connected;
  for (const c of ['green','red']) {
    const p = state.players[c]; $('' + c + '-name').textContent = p.name || 'Player'; $(c + '-score').textContent = p.score;
    $(c + '-hits').textContent = `${p.hits} hits · ${p.kills} cleared`;
    if (lastRound !== state.roundId || !$('name-' + c).dataset.dirty) $('name-' + c).value = p.name;
    if (lastRound !== state.roundId) delete $('name-' + c).dataset.dirty;
  }
  if (lastRound !== state.roundId) { $('mode').value = state.mode; $('chosen-color').value = state.firstColor; $('hit-feedback').textContent = 'Ready when you are.'; }
  lastRound = state.roundId;
  for (const t of state.targets) {
    const node = $('target-' + t.code); node.classList.toggle('active', t.active);
    node.dataset.hp = t.hp; node.dataset.spawn = t.spawnId;
    node.querySelector('.health').innerHTML = Array.from({ length:t.maxHp }, (_,i) => `<i class="${i<t.hp?'full':''}"></i>`).join('');
    node.querySelector('.health').setAttribute('aria-label', `${t.hp} of ${t.maxHp} health`);
    node.querySelector('.points').textContent = `${t.points}/hit`;
    if (hit?.code === t.code) {
      clearTimeout(node.hitTimer); node.classList.add('hit'); node.style.setProperty('--hit', hit.color === 'green' ? 'var(--green)' : 'var(--red)');
      const badge = node.querySelector('.damage'); badge.textContent = `+${hit.points}`; badge.hidden = false;
      node.hitTimer = setTimeout(() => { node.classList.remove('hit'); badge.hidden = true; }, 260);
    } else if (state.phase !== 'playing') { node.classList.remove('hit'); node.querySelector('.damage').hidden = true; }
  }
  $('banner').hidden = state.phase === 'playing';
  if (state.phase !== 'playing') {
    const players = Object.values(state.players).filter(p => state.mode !== 'single' || p.color === state.singleColor).sort((a,b)=>b.score-a.score);
    const tied = players.length > 1 && players[0].score === players[1].score;
    $('banner').innerHTML = state.phase === 'lobby' ? '<p class="eyebrow">TWO SCANNERS. TWO MINUTES.</p><h2>Turkey Shoot</h2><p>Enter names below, arm each scanner, and start a round.</p>' : `<p class="eyebrow">ROUND COMPLETE</p><h2>${tied ? 'It’s a tie!' : escape(players[0].name) + ' leads the hunt!'}</h2><p>${players.map(p => `${escape(p.name)}: ${p.score}`).join(' · ')}</p>`;
  }
  $('presence').textContent = ['green','red'].map(c => { const p=state.presence[c]; return `${c.toUpperCase()}: ${!p.connected ? 'offline' : p.connected > 1 ? p.connected + ' tabs — close extras' : !p.focused ? 'window inactive' : !p.armed ? 'not armed' : 'capture ready'}`; }).join(' · ');
  $('save-status').textContent = state.persistence === 'saved' ? 'Completed scores saved.' : state.persistence === 'saving' ? 'Saving completed scores…' : 'Score saving failed. Keep the server running; retrying automatically.';
  if (hit) $('hit-feedback').textContent = `${state.players[hit.color].name} hit ${hit.code} · +${hit.points}${hit.killed ? ' · target cleared!' : ` · ${hit.hp} HP left`}`;
  renderBoard();
}
socket.on('connect', () => { connected = true; $('connection').textContent = 'Connected'; $('connection').className = 'badge'; updateCapture(); sendPresence(); });
socket.on('disconnect', () => { connected = false; synced = false; $('connection').textContent = 'Disconnected'; $('connection').className = 'badge warning'; updateCapture(); if (role === 'gallery') $('start').disabled = true; });
socket.on('connect_error', error => { $('connection').textContent = 'Connection issue'; $('connection').className = 'badge warning'; updateCapture(); console.warn(error.message); });
socket.on('state', packet => {
  const received = performance.now();
  state = packet.state; synced = true; serverAtSync = state.serverNow; monoAtSync = received;
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
    if (!reducedMotion) for (const [i,t] of state.targets.entries()) {
      const angle = ((now - (state.startedAt || serverAtSync)) / 1000 + i*3) / 5;
      $('target-'+t.code).style.transform = `translate(${Math.sin(angle)*14}px,${Math.cos(angle*.7)*8}px)`;
    }
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
