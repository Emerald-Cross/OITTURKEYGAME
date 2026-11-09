import assert from 'node:assert/strict';
import { mkdtemp, rm, access, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createRuntime } from '../server.mjs';
const require=createRequire(import.meta.url);
let playwright;
try { playwright=await import('playwright'); }
catch { if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw Error('Optional browser test: install Playwright with npm install --no-save playwright, then npx playwright install chromium.'); playwright=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]})); }
const dir=await mkdtemp(join(tmpdir(),'turkey-browser-'));
let now=Date.now();const runtime=await createRuntime({dataDir:dir,clock:()=>now});const addr=await runtime.listen(0,'127.0.0.1');const base=`http://127.0.0.1:${addr.port}`;
let executablePath=process.env.BROWSER_EXECUTABLE;
if(!executablePath) try { await access('/usr/bin/chromium');executablePath='/usr/bin/chromium'; }catch{}
let browser;
const errors=[];
const capture=async(page,name)=>{
 if(!process.env.TURKEY_SCREENSHOT_DIR)return;
 await mkdir(process.env.TURKEY_SCREENSHOT_DIR,{recursive:true});
 await page.screenshot({path:join(process.env.TURKEY_SCREENSHOT_DIR,name+'.png'),fullPage:true});
 if(process.env.TURKEY_REVIEW_SHOTS)await page.screenshot({path:join(process.env.TURKEY_SCREENSHOT_DIR,name+'.jpg'),type:'jpeg',quality:80,fullPage:true});
};
try {
 browser=await playwright.chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
 const contexts=await Promise.all([0,1,2].map(()=>browser.newContext({viewport:{width:1440,height:1000}})));
 const [tv,g,r]=await Promise.all(contexts.map(c=>c.newPage()));
 for(const p of [tv,g,r])p.on('pageerror',error=>errors.push(error.message));
 await tv.goto(base+'/gallery');await g.goto(base+'/scan/green');await r.goto(base+'/scan/red');
 const connected=p=>p.waitForFunction(()=>document.querySelector('#connection').textContent==='Connected');
 await Promise.all([tv,g,r].map(connected));
 await tv.waitForFunction(()=>[...document.querySelectorAll('.target img')].every(img=>img.complete&&img.naturalWidth>0));
 for(const file of ['autumn-woods.png','woodland-sprites.png']){
  const response=await tv.request.get(base+'/assets/'+file);assert.equal(response.headers()['content-type'],'image/png');
  await tv.evaluate(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src=src;}),'/assets/'+file);
 }
 await tv.locator('#how-to').click();await tv.locator('#help-dialog').waitFor({state:'visible'});
 await tv.keyboard.press('Escape');await tv.locator('#help-dialog').waitFor({state:'hidden'});
 assert.equal(await tv.locator('#sound').getAttribute('aria-pressed'),'false');
 await capture(tv,'01-lobby');
 await g.locator('#player-name').fill('Grace');await g.locator('#name-form button').click();
 await r.locator('#player-name').fill('Rowan');await r.locator('#name-form button').click();
 await tv.waitForFunction(()=>document.querySelector('#name-red').value==='Rowan');
 await tv.locator('#start').click();
 await tv.locator('#banner').waitFor({state:'hidden'});
 await capture(tv,'02-playing');
 assert.equal(await tv.evaluate(()=>{
  const scene=document.querySelector('.gallery').getBoundingClientRect();
  return [...document.querySelectorAll('.target .card')].every(card=>{const r=card.getBoundingClientRect();return r.bottom<=scene.bottom&&r.top>=scene.top;});
 }),true,'All target codes and health bars must fit inside the scene');
 await g.bringToFront();await g.locator('#arm').click();await g.keyboard.type('TKY4');await g.keyboard.press('Enter');
 await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='25');
 assert.equal(await tv.locator('#target-TKY4').getAttribute('data-hp'),'3');
 // The new help dialog must not allow scanner input to reach the game behind it.
 await g.locator('#how-to').click();await g.evaluate(()=>document.querySelector('#help-dialog').focus());
 await g.keyboard.type('TKY4');await g.keyboard.press('Enter');
 assert.equal(await tv.locator('#green-score').textContent(),'25');
 await g.keyboard.press('Escape');await g.locator('#arm').click();
 await g.keyboard.type('TKY4');await g.keyboard.press('Enter');
 await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='50');
 await r.bringToFront();await r.locator('#arm').click();await r.keyboard.type('TKY4');await r.keyboard.press('Enter');
 await tv.waitForFunction(()=>document.querySelector('#red-score').textContent==='25');
 assert.equal(await tv.locator('#target-TKY4').getAttribute('data-hp'),'1');
 await r.locator('#simulator summary').click();await r.locator('#duplicate').click();
 await r.waitForFunction(()=>document.querySelector('#last-scan').textContent.includes('duplicate'));
 assert.equal(await tv.locator('#target-TKY4').getAttribute('data-hp'),'1');
 // Simulated shots travel through the same server path as Enter-terminated shots.
 await r.locator('[data-sim=TKY4]').click();await tv.waitForFunction(()=>document.querySelector('#target-TKY4').dataset.hp==='0');
 assert.equal(await tv.locator('#red-score').textContent(),'50');
 await r.locator('[data-sim=TKY4]').click();await r.waitForFunction(()=>document.querySelector('#last-scan').textContent.includes('inactive'));
 now+=1800;await tv.waitForFunction(()=>document.querySelector('#target-TKY4').dataset.hp==='4');
 // Trigger a genuine disconnect, let the client reconnect, then check fresh health/score.
 for(const client of runtime.io.clients)if(client.data.color==='red')client.close();
 await connected(r);await r.waitForFunction(()=>document.querySelector('#round-status').textContent.includes('50 points'));
 await r.locator('[data-sim=BEAR]').click();await tv.waitForFunction(()=>document.querySelector('#red-score').textContent==='90');
 await tv.waitForFunction(()=>document.querySelector('#diagnostic').textContent.includes('server receipt'));
 console.log('Browser software diagnostic:',await tv.locator('#diagnostic').textContent());
 // Focus/field state must visibly disarm capture rather than silently eating scans.
 await g.bringToFront();await g.locator('#arm').click();
 // Real focus changes are tested by opening an editable field in the next lobby.
 now+=120000;await tv.waitForFunction(()=>document.querySelector('#phase').textContent==='ROUND COMPLETE');
 await tv.waitForFunction(()=>document.querySelector('#save-status').textContent==='Completed scores saved.');
 assert.match(await tv.locator('#board').textContent(),/Rowan/);
 await capture(tv,'03-results');
 const screenshot=process.env.TURKEY_SCREENSHOT;
 if(screenshot) {await tv.screenshot({path:screenshot,fullPage:true});console.log('Screenshot:',screenshot);}
 await tv.locator('#reset').click();await tv.locator('#start').waitFor({state:'visible'});
 assert.equal(await tv.locator('#green-score').textContent(),'0');assert.equal(await tv.locator('#name-green').inputValue(),'');
 await g.bringToFront();await g.locator('#player-name').focus();
 await g.waitForFunction(()=>document.querySelector('#capture-status').textContent.includes('Editing'));
 assert.equal(errors.length,0,errors.join('\n'));
 // Verify layouts at TV 1080p and narrow scanner width without horizontal overflow.
 await tv.setViewportSize({width:1920,height:1080});await r.setViewportSize({width:390,height:844});
 for(const p of [tv,r])assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await capture(tv,'04-tv-1080p');await r.bringToFront();await capture(r,'05-scanner-mobile');
 // Mode cards must submit the selected settings and visibly identify whose turn it is.
 await tv.locator('#name-green').fill('Grace');await tv.locator('#name-red').fill('Rowan');
 await tv.locator('[data-mode=alternating]').click();await tv.locator('#chosen-color').selectOption('red');
 await tv.locator('#start').click();await tv.waitForFunction(()=>document.querySelector('#phase').textContent.startsWith('RED TURN'));
 assert.equal(await tv.locator('#player-green').evaluate(e=>e.classList.contains('off-turn')),true);
 await g.locator('#simulator summary').click();await g.locator('[data-sim=TKY4]').click();
 await g.waitForFunction(()=>document.querySelector('#last-scan').textContent.includes('Wait for your turn'));
 await r.locator('[data-sim=TKY4]').click();await tv.waitForFunction(()=>document.querySelector('#red-score').textContent==='25');
 now+=15000;await tv.waitForFunction(()=>document.querySelector('#phase').textContent.startsWith('GREEN TURN'));
 await g.locator('[data-sim=TKY4]').click();await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='25');
 // The fullscreen TV view must fit and keep the end-round control available.
 await tv.bringToFront();await tv.locator('#fullscreen').click();await tv.waitForFunction(()=>Boolean(document.fullscreenElement));
 assert.equal(await tv.locator('.below').isVisible(),false);
 assert.equal(await tv.evaluate(()=>document.querySelector('.arena').getBoundingClientRect().bottom<=innerHeight),true);
 await capture(tv,'06-fullscreen-hunt');await tv.locator('#finish').click();
 await tv.waitForFunction(()=>document.querySelector('[data-next]')?.disabled===false);
 assert.match(await tv.locator('#banner').textContent(),/fowl tie/);
 await capture(tv,'07-fullscreen-tie');await tv.locator('[data-next]').click();
 await tv.locator('#fullscreen').click();await tv.waitForFunction(()=>!document.fullscreenElement);
 await tv.locator('[data-mode=single]').click();await tv.locator('#chosen-color').selectOption('red');
 assert.equal(await tv.locator('#name-green').isDisabled(),true);assert.equal(await tv.locator('#name-red').isDisabled(),false);
 await tv.locator('#name-red').fill('<b>Feather Boss</b>');await tv.locator('#start').click();
 await r.locator('[data-sim=BEAR]').click();await tv.waitForFunction(()=>document.querySelector('#red-score').textContent==='40');
 const reduced=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 const reducedTV=await reduced.newPage();await reducedTV.goto(base+'/gallery');await connected(reducedTV);
 assert.equal(await reducedTV.locator('.falling-leaves').evaluate(e=>getComputedStyle(e).display),'none');
 assert.equal(await reducedTV.locator('#target-TKY4').evaluate(e=>getComputedStyle(e).transform),'none');
 await reduced.close();
 await tv.locator('#finish').click();await tv.waitForFunction(()=>document.querySelector('[data-next]')?.disabled===false);
 assert.match(await tv.locator('.winner-title').textContent(),/<b>Feather Boss<\/b>/);
 assert.equal(await tv.locator('.winner-title b').count(),0,'Player names must remain text');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: Chromium gallery + green/red capture, Enter scans, repeated shots, duplicates, inactive targets, respawn, reconnect, timing, timed finish, leaderboard, reset, focus editing, responsive layout.');
 console.log('PASS: illustrated assets, help/capture isolation, mode cards, alternating turns, solo scanner choice, fullscreen play/reset, tied results, escaped names, reduced motion, screenshot capture.');
} finally {await browser?.close();await runtime.close();await rm(dir,{recursive:true,force:true});}

