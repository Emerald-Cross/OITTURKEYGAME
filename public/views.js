import { ANIMALS } from '/encounters.js';
export const targets = Object.fromEntries(Object.entries(ANIMALS).map(([code,t]) => [code, { ...t, name: t.label, hits: t.action === 'shoot' ? 1 : 0 }]));
const paths = {
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 3 4-3M8 20l4-3 4 3M3 11l4-2-1-5M21 13l-4 2 1 5M3 13l4 2-1 5M21 11l-4-2 1-5"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5m0 3h.01"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v2c0 3 2 4 5 4m7-6h4v2c0 3-2 4-5 4m-3 2v7m-4 1h8"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 5 6m0-6-5 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
  turn: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>'
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.snow}</svg>`;
const player = c => `<div class="player ${c}" id="player-${c}"><div class="player-mark">${icon('target')}</div><div class="player-identity"><small>${c.toUpperCase()} SCANNER</small><span id="${c}-name">Player</span><small id="${c}-hits">0 cleared · 0 mistakes</small><div class="streak-badge"><b id="${c}-multiplier">×1</b><span id="${c}-streak">0 streak</span></div></div><div class="player-points"><strong id="${c}-score">0</strong><small>POINTS</small></div></div>`;
export const galleryView = () => `
  <section class="arena" tabindex="-1" aria-label="Merry Mayhem Christmas arcade">
    <section class="hud" aria-label="Live scores">${player('green')}<div class="clock"><small>MERRY MAYHEM</small><strong id="clock">02:00</strong><span id="phase">PREPARE A GROUP</span><div class="timer-track"><i id="timer-fill"></i></div></div>${player('red')}</section>
    <div class="hunt-rules" aria-label="Scoring rules"><span>Snowmen +10</span><span class="gold-rule">Gold gifts +30</span><span>Santa / reindeer −25</span></div>
    <section class="gallery" aria-label="Shooting gallery">
      <div class="sun-haze" aria-hidden="true"></div>
      <img class="winter-cover cover-left" src="/assets/winter-cover.svg" alt="" aria-hidden="true">
      <img class="winter-cover cover-right" src="/assets/winter-cover.svg" alt="" aria-hidden="true">
      <div class="village-lantern" aria-hidden="true"></div>
      <div class="target-layer">
        <article class="creature" id="creature" hidden>
          <div class="ground-shadow" aria-hidden="true"></div>
          <div class="animal-body"><div id="animal-art" class="animal sprite snowman" aria-hidden="true"></div><div class="scan-patch" id="scan-patch" hidden><img id="animal-code" alt="" draggable="false" width="360" height="360"></div></div>
          <span id="damage" class="damage" hidden></span><div class="impact-ring" aria-hidden="true"></div><div class="impact-burst sprite puff" aria-hidden="true"></div>
        </article>
      </div>
      <div class="snowfall" aria-hidden="true">${[0,1,2,3,4,5].map(i=>`<span style="--i:${i}">${icon('snow')}</span>`).join('')}</div>
      <div class="snowbank-edge" aria-hidden="true"></div>
      <div id="encounter-info" class="encounter-info" hidden><p class="eyebrow" id="encounter-tag"></p><h2 id="animal-name"></h2><div class="target-action" id="animal-health"></div><p id="animal-points"></p><div class="window-track"><i id="window-fill"></i></div></div>
      <p id="encounter-cue" class="encounter-cue" role="status"></p>
      <div id="banner" class="banner"></div>
    </section>
    <div class="field-strip"><div class="field-live"><span class="live-dot"></span><span id="hit-feedback" aria-live="polite">Waiting for a scan.</span></div><button id="finish" type="button" class="quiet end-round" hidden>End round</button></div>
  </section>
  <dialog id="setup-dialog" aria-label="Prepare a round"><button type="button" id="close-setup" class="quiet close-setup" aria-label="Back to the snow">✕</button><div class="below" id="round-setup">
    <section class="panel controls"><div class="panel-heading"><div><p class="eyebrow">AT THE LODGE</p><h2>Set up players.</h2></div></div>
      <form id="setup-form"><div class="row name-row"><label class="hunter-field green"><span><i></i> Green player</span><input id="name-green" maxlength="24" placeholder="Player name" autocomplete="off"></label><label class="hunter-field red"><span><i></i> Red player</span><input id="name-red" maxlength="24" placeholder="Player name" autocomplete="off"></label></div>
      <fieldset class="mode-picker"><legend>Choose your game</legend><select id="mode" class="sr-only" tabindex="-1" aria-label="Play mode"><option value="simultaneous">Together</option><option value="alternating">Take turns</option><option value="single">Solo run</option></select><div class="mode-options">${[['simultaneous','users','Head-to-head','Both scanners live'],['alternating','turn','Take turns','15 seconds each'],['single','user','Solo run','One scanner']].map(([v,i,title,note])=>`<button class="mode-option ${v==='simultaneous'?'selected':''}" type="button" data-mode="${v}" aria-pressed="${v==='simultaneous'}">${icon(i)}<strong>${title}</strong><small>${note}</small><span class="mode-check">${icon('check')}</span></button>`).join('')}</div></fieldset>
      <div id="color-choice-label" class="color-choice" hidden><label><span id="color-choice-copy">First scanner</span><select id="chosen-color"><option value="green">Green scanner</option><option value="red">Red scanner</option></select></label></div><p id="mode-note" class="mode-note">Both players race for the same one-scan targets.</p><button id="start" type="submit" class="primary start-hunt">Let it snow ${icon('arrow')}</button><p class="start-note">${icon('clock')} 2-minute round <span>·</span> Scan the codes on the TV to score</p></form>
      <div id="round-summary" class="round-summary" hidden><h3>Round in progress.</h3><p>Keep the scanner windows active.</p></div>
      <div class="round-actions"><button id="reset" class="primary" hidden>Next group ${icon('arrow')}</button><button id="retry-save" class="quiet" hidden>Retry score save</button></div>
      <div id="presence" class="presence" aria-label="Scanner stations"></div><p id="save-status" class="muted save-status"></p>
      <details class="tech-notes"><summary>Connection & diagnostics ${icon('chevron')}</summary><div id="diagnostic" class="diag">Waiting for a hit…</div><p class="muted">One scan clears a snowman: +10 points, or +30 for a gold present. Hold fire for Santa and reindeer: scanning them costs up to 25 points and resets your streak. Three clean hits raise your multiplier, up to ×3. Each appearance has a fresh identity; a held trigger cannot repeatedly deduct points.</p><p class="muted">Software timings exclude scanner decoding and physical TV delay. Frame callbacks are scheduling measurements.</p></details>
    </section>
    <section class="panel leaderboard"><div class="panel-heading"><div><p class="eyebrow">COMPLETED ROUNDS</p><h2>${icon('trophy')} Leaderboard.</h2></div><label class="board-filter"><span class="sr-only">Leaderboard mode</span><select id="board-mode"><option value="all">All rounds</option><option value="simultaneous">Head-to-head</option><option value="alternating">Take turns</option><option value="single">Solo run</option></select></label></div><table><thead><tr><th>RANK</th><th>PLAYER</th><th>POINTS</th></tr></thead><tbody id="board"></tbody></table><p class="board-note">Current scoring rules · Top 50 kept, 8 shown</p><div class="board-quoter"><span class="sprite snowman" aria-hidden="true"></span><p>Brrr!</p></div></section>
  </div></dialog>`;

export const stationView = color => `<section class="station ${color}"><a class="back-link" href="/gallery" target="_blank" rel="noopener">${icon('external')} Open TV gallery</a><div class="station-top"><div class="station-badge">${icon('target')}</div><div><p class="eyebrow">${color === 'green' ? 'EAST COMPUTER' : 'STUDENT MAIN COMPUTER'}</p><h1>${color[0].toUpperCase()+color.slice(1)} scanner.</h1><p>Scan snowmen and gold presents. Hold fire for Santa and reindeer.</p></div><div class="station-mascot sprite ${color==='green'?'snowman':'gift'}" aria-hidden="true"></div></div>
    <form id="name-form" class="panel station-name"><label>Your player name<input id="player-name" maxlength="24" placeholder="Player name" autocomplete="off"></label><button class="primary">Save name ${icon('check')}</button></form>
    <section id="capture-box" class="capture-box warning"><div class="capture-beacon">${icon('target')}</div><p class="eyebrow">SCANNER CAPTURE</p><h2 id="capture-status" role="status">Click to arm capture</h2><p id="round-status">Waiting for the gallery…</p><button id="arm" class="primary">Arm scanner capture ${icon('arrow')}</button><div class="last-scan-wrap"><small>LAST SCAN</small><div id="last-scan" role="status" aria-live="polite">No scans yet.</div></div></section>
    <div class="station-instruction">${icon('check')} <p><strong>Leave this window active.</strong> Aim at a code on the TV and scan. If you edit your name or switch windows, return here and check that capture is ready.</p></div>
    <details id="simulator" class="panel"><summary>Test without a scanner ${icon('chevron')}</summary><p>During a round, use these buttons or press 1, 4, S, D. Santa and reindeer scans test the hold-fire penalty. Close this panel before using a real scanner.</p><div class="sim-grid">${Object.keys(targets).map(code=>`<button type="button" class="quiet" data-sim="${code}">Scan ${code}</button>`).join('')}<button id="duplicate" class="quiet">Repeat last network delivery</button></div></details>
    <details class="panel station-diagnostics"><summary>Connection & timing ${icon('chevron')}</summary><div id="scan-diagnostic" class="diag">Waiting for a scan…</div><p class="muted">Scanner output must end with Enter / carriage return. Disconnected shots are discarded. Unconfirmed shots are never automatically replayed; check the TV before scanning again.</p></details></section>`;

export const helpView = () => `<div class="help-header"><p class="eyebrow">HOW TO PLAY</p><button id="close-help" class="quiet" aria-label="Close instructions">✕</button></div><h2>Merry Mayhem</h2><ol class="help-steps"><li><strong>Get connected.</strong><p>Open the green capture page on East and the red one on Student Main. Keep the TV on the gallery.</p></li><li><strong>Prepare the players.</strong><p>Enter names at the lodge, choose a mode, then arm each scanner. Keep the capture windows active.</p></li><li><strong>Scan the code.</strong><p>One scan clears a snowman. Gold presents are worth more. Leave Santa and reindeer alone: scanning them costs up to 25 points and resets your streak. Every three clean hits increase your multiplier, up to ×3. Highest score after two minutes wins.</p></li></ol><div class="help-targets">${Object.values(targets).map(t=>`<div><span class="sprite ${t.art} ${t.code==='GIFT'?'gold-art':''}" aria-hidden="true"></span><strong>${t.action==='shoot'?'+'+t.points:'−'+t.penalty}<small> PTS</small></strong><small>${t.action==='shoot'?'One scan':'Hold fire'}</small></div>`).join('')}</div><p class="help-footnote">One large code at a time. Scanning Santa or reindeer is counted once per player per appearance.</p>`;

