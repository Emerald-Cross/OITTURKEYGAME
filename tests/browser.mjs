import assert from 'node:assert/strict';
import { mkdtemp, rm, access, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createRuntime } from '../server.mjs';
import { APPROACH_MS, PEEK_MS, ANIMALS } from '../public/encounters.js';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=await import('playwright');}catch{if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw Error('Install the optional Playwright browser test dependency.');playwright=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));}
const dir=await mkdtemp(join(tmpdir(),'turkey-browser-'));
let now=Date.now(),seed=11;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const runtime=await createRuntime({dataDir:dir,clock:()=>now,random});const address=await runtime.listen(0,'127.0.0.1'),base=`http://127.0.0.1:${address.port}`;
let executablePath=process.env.BROWSER_EXECUTABLE;
if(!executablePath)try{await access('/usr/bin/chromium');executablePath='/usr/bin/chromium';}catch{}
let browser,tv,g,r;
const errors=[];
const capture=async(page,name)=>{
 if(!process.env.TURKEY_SCREENSHOT_DIR)return;
 await mkdir(process.env.TURKEY_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.TURKEY_SCREENSHOT_DIR,name+'.png'),fullPage:true});
};
const connected=page=>page.waitForFunction(()=>document.querySelector('#connection').textContent==='Connected');
const sync=()=>runtime.io.broadcast('state',{state:runtime.snapshot()});
const move=async value=>{assert.ok(value>=now,'Browser fixture clock must move forward');now=value;await new Promise(resolve=>setTimeout(resolve,80));sync();};
async function expose(code){
 assert.equal(runtime.game.phase,'playing');
 if(runtime.game.encounter.clearedAt!==null||now>=runtime.game.encounter.concealAt)await move(runtime.game.encounter.nextAt);
 for(let i=0;code&&runtime.game.encounter.code!==code;i++){assert.ok(i<16&&runtime.game.phase==='playing','Requested animal must appear during this round');await move(runtime.game.encounter.nextAt);}
 await move(Math.max(now,runtime.game.encounter.revealAt));
 await tv.waitForFunction(expected=>document.querySelector('#creature').dataset.code===expected&&!document.querySelector('#scan-patch').hidden,runtime.game.encounter.code);
 return runtime.game.encounter;
}
async function scan(page,code){
 await page.locator(`[data-sim=${code}]`).click();
 await page.waitForFunction(()=>!document.querySelector('#last-scan').textContent.includes('sending'));
}
async function begin(mode='simultaneous',chosen='green',names=['Grace','Rowan']){
 if(!await tv.locator('#setup-dialog').isVisible())await tv.locator('[data-setup]').click();
 await tv.locator(`[data-mode=${mode}]`).click();if(mode!=='simultaneous')await tv.locator('#chosen-color').selectOption(chosen);
 for(const [i,color]of['green','red'].entries())if(!await tv.locator('#name-'+color).isDisabled())await tv.locator('#name-'+color).fill(names[i]);
 await tv.locator('#start').click();await tv.locator('#banner').waitFor({state:'hidden'});assert.equal(await tv.locator('#setup-dialog').isVisible(),false);
}
async function finish(){
 if(await tv.locator('#setup-dialog').isVisible())await tv.locator('#close-setup').click();
 await tv.locator('#finish').click();await tv.waitForFunction(()=>document.querySelector('[data-next]')?.disabled===false);
 assert.equal(await tv.locator('#scan-patch').isVisible(),false);assert.equal(await tv.locator('#setup-dialog').isVisible(),false);
}
async function next(){await tv.locator('[data-next]').click();await tv.locator('#setup-dialog').waitFor({state:'visible'});}
async function scanArea(page,minWidth=0){
 const details=await page.evaluate(()=>{
  const image=document.querySelector('#animal-code'),rect=image.getBoundingClientRect(),scene=document.querySelector('.gallery').getBoundingClientRect();
  const overlaps=[...document.querySelectorAll('#encounter-info,#encounter-cue,.hud,.hunt-rules,header,.field-strip')].filter(node=>{if(!node.checkVisibility())return false;const box=node.getBoundingClientRect();return rect.left<box.right&&rect.right>box.left&&rect.top<box.bottom&&rect.bottom>box.top;}).map(node=>node.id||node.className);
  return{code:document.querySelector('#creature').dataset.code,viewport:[innerWidth,innerHeight],width:rect.width,height:rect.height,fits:rect.left>=scene.left&&rect.right<=scene.right&&rect.top>=scene.top&&rect.bottom<=scene.bottom,overlaps,
   count:[...document.querySelectorAll('img[src^="/qr/"]')].filter(node=>node.checkVisibility()).length,
   filters:[image,image.parentElement,image.parentElement.parentElement,document.querySelector('#creature')].map(node=>getComputedStyle(node).filter)};
 });
 assert.equal(details.count,1,'Exactly one visible QR: '+JSON.stringify(details));assert.equal(details.fits,true,'QR bounds: '+JSON.stringify(details));assert.deepEqual(details.overlaps,[],'QR overlay: '+JSON.stringify(details));
 assert.ok(Math.abs(details.width-details.height)<.1,'QR remains square');assert.ok(details.width>=minWidth,'QR is large enough: '+JSON.stringify(details));assert.deepEqual(details.filters,['none','none','none','none'],'Animal tint must not reach the QR');
}
async function fullBody(phase,at){
 await move(at);await tv.waitForFunction(expected=>document.querySelector('#creature').dataset.stage===expected,phase);
 const data=await tv.evaluate(()=>{const creature=document.querySelector('#creature'),body=creature.querySelector('.animal-body'),art=document.querySelector('#animal-art');return{clips:[creature,body,art].map(node=>getComputedStyle(node).clipPath),masks:[creature,body,art].map(node=>getComputedStyle(node).maskImage),heights:[creature,body,art].map(node=>node.offsetHeight),codeHidden:document.querySelector('#scan-patch').hidden};});
 assert.deepEqual(data.clips,['none','none','none']);assert.deepEqual(data.masks,['none','none','none']);assert.equal(data.heights[0],data.heights[1]);assert.equal(data.heights[0],data.heights[2]);assert.equal(data.codeHidden,true);
}
try{
 browser=await playwright.chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
 const contexts=await Promise.all([0,1,2].map(()=>browser.newContext({viewport:{width:1920,height:1080}})));
 [tv,g,r]=await Promise.all(contexts.map(context=>context.newPage()));await tv.clock.install();
 for(const page of[tv,g,r])page.on('pageerror',error=>errors.push(error.message));
 await tv.goto(base+'/gallery');await g.goto(base+'/scan/green');await r.goto(base+'/scan/red');await Promise.all([tv,g,r].map(connected));
 for(const asset of['autumn-woods.png','woodland-sprites.png','woodland-cover.svg']){
  assert.equal((await tv.request.get(base+'/assets/'+asset)).status(),200);
  await tv.evaluate(src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=src;}),'/assets/'+asset);
 }
 assert.equal((await tv.request.get(base+'/qr/DEER.svg')).status(),200);
 assert.equal(await tv.locator('#sound').getAttribute('aria-pressed'),'false');
 await tv.locator('#how-to').click();await tv.locator('#help-dialog').waitFor({state:'visible'});assert.equal(await tv.locator('.help-targets>div').count(),4);await tv.keyboard.press('Escape');
 assert.match(await tv.locator('.speech-bubble').textContent(),/Gobble gobble/);await capture(tv,'01-lobby');
 await g.locator('#player-name').fill('Grace');await g.locator('#name-form button').click();await r.locator('#player-name').fill('Rowan');await r.locator('#name-form button').click();
 await tv.locator('[data-setup]').click();await tv.waitForFunction(()=>document.querySelector('#name-red').value==='Rowan');await capture(tv,'02-setup');await begin();
 await tv.locator('#sound').click();assert.equal(await tv.locator('#sound').getAttribute('aria-pressed'),'true');
 await g.bringToFront();await g.locator('#arm').click();await g.keyboard.type('TKY1');await g.keyboard.press('Enter');await g.waitForFunction(()=>document.querySelector('#last-scan').textContent.includes('inactive'));
 await expose('TKY1');await scanArea(tv,440);assert.equal(await tv.locator('#animal-health').textContent(),'SCAN');await capture(tv,'03-turkey');
 await g.keyboard.type('TKY1');await g.keyboard.press('Enter');await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='10');
 assert.equal(await tv.locator('#scan-patch').isVisible(),false,'One Enter hides and clears the turkey synchronously');assert.equal(runtime.game.players.green.streak,1);await capture(tv,'04-impact');
 await g.locator('#simulator summary').click();await g.locator('#duplicate').click();await g.waitForFunction(()=>document.querySelector('#last-scan').textContent.includes('duplicate'));assert.equal(runtime.game.players.green.score,10);
 await r.locator('#simulator summary').click();await scan(r,'TKY1');assert.equal(runtime.game.players.red.score,0);assert.equal(runtime.game.players.red.mistakes,0);
 await expose('TKY4');await scanArea(tv,440);assert.equal(await tv.locator('#creature').getAttribute('class').then(s=>s.includes('golden')),true);await capture(tv,'05-gold');
 await scan(r,'TKY4');await tv.waitForFunction(()=>document.querySelector('#red-score').textContent==='30');
 await expose('TKY1');await g.bringToFront();await g.locator('#simulator summary').click();await g.locator('#arm').click();await g.locator('#how-to').click();await g.evaluate(()=>document.querySelector('#help-dialog').focus());
 await g.keyboard.type('TKY1');await g.keyboard.press('Enter');assert.equal(runtime.game.players.green.score,10,'Instructions pause hardware capture');await g.keyboard.press('Escape');await g.locator('#arm').click();
 await g.keyboard.type('TKY1');await g.keyboard.press('Enter');await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='20');await g.locator('#simulator summary').click();
 await expose('TKY1');await scan(g,'TKY1');await tv.waitForFunction(()=>document.querySelector('#green-multiplier').textContent==='×2');
 await expose('TKY1');await scan(g,'TKY1');await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='50');assert.equal(runtime.game.players.green.streak,4);
 await expose('DEER');await scanArea(tv,440);assert.equal(await tv.locator('#animal-health').textContent(),'HOLD FIRE');await capture(tv,'06-hold-fire');
 await scan(g,'DEER');await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='25');assert.equal(await tv.locator('#green-multiplier').textContent(),'×1');assert.equal(await tv.locator('#scan-patch').isVisible(),true);
 assert.equal(await tv.locator('#damage').evaluate(node=>node.getBoundingClientRect().bottom<=document.querySelector('#animal-code').getBoundingClientRect().top),true,'Penalty feedback stays clear of the active QR');
 await scan(g,'DEER');assert.equal(runtime.game.players.green.score,25);assert.equal(runtime.game.players.green.mistakes,1);assert.match(await g.locator('#last-scan').textContent(),/Already counted/);
 await scan(r,'DEER');await tv.waitForFunction(()=>document.querySelector('#red-score').textContent==='5');assert.equal(runtime.game.players.red.mistakes,1);
 await tv.locator('#sound').click();await finish();await next();assert.equal(await tv.locator('#green-score').textContent(),'0');assert.equal(await tv.locator('#green-multiplier').textContent(),'×1');
 // Recovery and hold-fire resolution use a fresh round, with real browser sockets.
 await begin();await expose('TKY1');await scan(g,'TKY1');await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='10');await expose('DEER');
 const second=await contexts[0].newPage();await second.goto(base+'/gallery');await connected(second);await second.locator('#scan-patch').waitFor({state:'visible'});await scanArea(second,440);assert.equal(await second.locator('#animal-health').textContent(),'HOLD FIRE');await second.close();
 for(const client of runtime.io.clients)if(client.data.role==='gallery')client.close();await tv.locator('#scan-patch').waitFor({state:'hidden'});await connected(tv);await tv.locator('#scan-patch').waitFor({state:'visible'});
 for(const client of runtime.io.clients)if(client.data.color==='green')client.close();await g.waitForFunction(()=>document.querySelector('#connection').textContent!=='Connected');await connected(g);await g.waitForFunction(()=>!/Disconnected|Synchronizing/.test(document.querySelector('#capture-status').textContent));
 await tv.clock.fastForward(6000);await tv.waitForFunction(()=>document.querySelector('#scan-patch').hidden);assert.equal(runtime.game.targets.find(t=>t.code==='DEER').active,true,'TV expires the code before a server packet');
 await move(runtime.game.encounter.concealAt);await tv.waitForFunction(()=>document.querySelector('#creature').classList.contains('safe'));assert.equal(runtime.game.players.green.score,10);assert.equal(runtime.game.players.green.streak,1);await capture(tv,'07-safe');
 await expose('TKY1');await scan(g,'TKY1');await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='20');await tv.waitForFunction(()=>document.querySelector('#diagnostic').textContent.includes('server receipt'));
 await tv.bringToFront();await tv.locator('#fullscreen').click();await tv.waitForFunction(()=>Boolean(document.fullscreenElement));await expose('BEAR');await scanArea(tv,440);await capture(tv,'08-fullscreen');
 await tv.locator('#camp').click();await move(runtime.game.endsAt);await tv.waitForFunction(()=>document.querySelector('[data-next]')?.disabled===false);assert.equal(await tv.locator('#setup-dialog').isVisible(),false);assert.equal(await tv.locator('#scan-patch').isVisible(),false);await capture(tv,'09-results');
 await next();await tv.locator('#close-setup').click();await tv.locator('#fullscreen').click();await tv.waitForFunction(()=>!document.fullscreenElement);await tv.locator('#camp').click();
 await g.bringToFront();await g.locator('#player-name').focus();await g.waitForFunction(()=>document.querySelector('#capture-status').textContent.includes('Editing'));
 await begin('alternating','red');await expose('TKY1');await scan(g,'TKY1');assert.match(await g.locator('#last-scan').textContent(),/Wait for your turn/);assert.equal(await tv.locator('#player-green').evaluate(node=>node.classList.contains('off-turn')),true);
 await move(runtime.game.startedAt+15000);await tv.waitForFunction(()=>document.querySelector('#phase').textContent.startsWith('GREEN TURN'));assert.equal(await tv.locator('#player-red').evaluate(node=>node.classList.contains('off-turn')),true);await finish();assert.match(await tv.locator('#banner').textContent(),/Tie\./);await next();
 await begin('single','red',['Unused','<b>Feather Boss</b>']);assert.equal(await tv.locator('#name-green').isDisabled(),true);await expose('TKY1');await scan(r,'TKY1');await expose('TKY4');await scan(r,'TKY4');await expose('TKY1');await scan(r,'TKY1');await expose('TKY1');await scan(r,'TKY1');await tv.waitForFunction(()=>document.querySelector('#red-score').textContent==='70');
 await expose('DEER');const reduced=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});const reducedTV=await reduced.newPage();await reducedTV.goto(base+'/gallery');await connected(reducedTV);await reducedTV.locator('#scan-patch').waitFor({state:'visible'});await scanArea(reducedTV,440);
 assert.equal(await reducedTV.locator('.falling-leaves').evaluate(node=>getComputedStyle(node).display),'none');assert.match(await reducedTV.locator('#creature').evaluate(node=>getComputedStyle(node).transform),/^matrix\(/);await reduced.close();
 await r.setViewportSize({width:390,height:844});await capture(r,'10-mobile-scanner');for(const page of[tv,r])assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await finish();assert.match(await tv.locator('.winner-title').textContent(),/<b>Feather Boss<\/b>/);assert.equal(await tv.locator('.winner-title b').count(),0);assert.equal(await tv.locator('.result-player').count(),1);await next();
 // Every animal appears in a balanced bag. Exercise all four paths and all TV/
 // workstation/phone layouts, including the new deer patch and wildlife labels.
 await begin('simultaneous','green',['Layout G','Layout R']);const seen=new Set();
 for(let i=0;i<8;i++){
  await tv.setViewportSize({width:1920,height:1080});const encounter={...runtime.game.encounter};
  await fullBody('approach',encounter.startedAt+1);await fullBody('peek',encounter.startedAt+APPROACH_MS+1);await fullBody('dodge',encounter.startedAt+APPROACH_MS+PEEK_MS+1);
  await expose();seen.add(encounter.code);
  for(let path=0;path<4;path++){
   runtime.game.encounter.path=path;sync();
   for(const [width,height,min]of[[1920,1080,440],[1440,900,370],[390,844,0]]){
    await tv.setViewportSize({width,height});sync();await tv.locator('#scan-patch').waitFor({state:'visible'});await scanArea(tv,min);assert.equal(await tv.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
  }
  await tv.setViewportSize({width:1920,height:1080});sync();
  if(i<4)await capture(tv,`11-layout-${i}-${encounter.code}`);
  await fullBody('retreat',encounter.concealAt+1);await move(runtime.game.encounter.nextAt);
 }
 assert.equal(seen.size,Object.keys(ANIMALS).length);await finish();assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: one-scan turkey clears, gold bonus, shoot/hold-fire choices, once-per-animal penalties, streak multipliers, strong clear feedback, duplicate/race handling, capture/help isolation, safe holds, client expiry, both reconnects, multiple TVs, deadline, modes, results/reset, escaped names, reduced motion, full sprites, and every animal/path/viewport QR layout.');
}finally{await browser?.close();await runtime.close();await rm(dir,{recursive:true,force:true});}
