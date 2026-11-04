import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
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
try {
 browser=await playwright.chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
 const contexts=await Promise.all([0,1,2].map(()=>browser.newContext({viewport:{width:1440,height:1000}})));
 const [tv,g,r]=await Promise.all(contexts.map(c=>c.newPage()));
 for(const p of [tv,g,r])p.on('pageerror',error=>errors.push(error.message));
 await tv.goto(base+'/gallery');await g.goto(base+'/scan/green');await r.goto(base+'/scan/red');
 const connected=p=>p.waitForFunction(()=>document.querySelector('#connection').textContent==='Connected');
 await Promise.all([tv,g,r].map(connected));
 await g.locator('#player-name').fill('Grace');await g.locator('#name-form button').click();
 await r.locator('#player-name').fill('Rowan');await r.locator('#name-form button').click();
 await tv.waitForFunction(()=>document.querySelector('#name-red').value==='Rowan');
 await tv.locator('#start').click();
 await tv.locator('#banner').waitFor({state:'hidden'});
 await g.bringToFront();await g.locator('#arm').click();await g.keyboard.type('TKY4');await g.keyboard.press('Enter');
 await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='25');
 assert.equal(await tv.locator('#target-TKY4').getAttribute('data-hp'),'3');
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
 console.log('PASS: Chromium gallery + green/red capture, Enter scans, repeated shots, duplicates, inactive targets, respawn, reconnect, timing, timed finish, leaderboard, reset, focus editing, responsive layout.');
} finally {await browser?.close();await runtime.close();await rm(dir,{recursive:true,force:true});}
