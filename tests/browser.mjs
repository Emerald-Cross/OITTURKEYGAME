import assert from 'node:assert/strict';
import { mkdtemp, rm, access, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createRuntime } from '../server.mjs';
const require=createRequire(import.meta.url);
let playwright;
try { playwright=await import('playwright'); }
catch { if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw Error('Optional browser test: install Playwright with npm install --no-save playwright, then npx playwright install chromium.'); playwright=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]})); }
const dir=await mkdtemp(join(tmpdir(),'turkey-browser-'));
let now=Date.now();
const runtime=await createRuntime({dataDir:dir,clock:()=>now});
const addr=await runtime.listen(0,'127.0.0.1'),base=`http://127.0.0.1:${addr.port}`;
let executablePath=process.env.BROWSER_EXECUTABLE;
if(!executablePath)try {await access('/usr/bin/chromium');executablePath='/usr/bin/chromium';}catch{}
let browser;
const errors=[];
const capture=async(page,name)=>{
 if(!process.env.TURKEY_SCREENSHOT_DIR)return;
 await mkdir(process.env.TURKEY_SCREENSHOT_DIR,{recursive:true});
 await page.screenshot({path:join(process.env.TURKEY_SCREENSHOT_DIR,name+'.png'),fullPage:true});
 if(process.env.TURKEY_REVIEW_SHOTS)await page.screenshot({path:join(process.env.TURKEY_SCREENSHOT_DIR,name+'.jpg'),type:'jpeg',quality:80,fullPage:true});
};
const connected=p=>p.waitForFunction(()=>document.querySelector('#connection').textContent==='Connected');
const move=async(value)=>{
 now=value;
 // Allow the actual 50 ms server timer to publish the new encounter state.
 await new Promise(resolve=>setTimeout(resolve,90));
};
async function reveal(tv,code=runtime.game.encounter.code){
 while(runtime.game.encounter.code!==code)await move(runtime.game.encounter.nextAt);
 await move(runtime.game.encounter.revealAt);
 await tv.waitForFunction(expected=>document.querySelector('#creature').dataset.code===expected&&!document.querySelector('#scan-patch').hidden,code);
}
async function assertScanArea(tv,minWidth=0){
 const details=await tv.evaluate(()=>{
  const image=document.querySelector('#animal-code'),r=image.getBoundingClientRect(),scene=document.querySelector('.gallery').getBoundingClientRect();
  const info=document.querySelector('#encounter-info').getBoundingClientRect();
  return {width:r.width,height:r.height,fits:r.left>=scene.left&&r.right<=scene.right&&r.top>=scene.top&&r.bottom<=scene.bottom,
   overlapsInfo:r.left<info.right&&r.right>info.left&&r.top<info.bottom&&r.bottom>info.top,
   count:[...document.querySelectorAll('img[src^="/qr/"]')].filter(n=>n.checkVisibility()).length,
   style:{transform:getComputedStyle(image).transform,filter:getComputedStyle(image).filter,opacity:getComputedStyle(image).opacity},
   rect:{x:r.x,y:r.y,w:r.width,h:r.height}};
 });
 assert.equal(details.count,1,'Exactly one QR is visible');
 assert.equal(details.fits,true,'The entire QR, including its quiet zone, fits in the scene');
 assert.equal(details.overlapsInfo,false,'Health and animal labels cannot cover the code');
 assert.ok(Math.abs(details.width-details.height)<.1,'The QR grid is square');
 assert.ok(details.width>=minWidth,`QR ${details.width}px should be at least ${minWidth}px wide`);
 assert.equal(details.style.transform,'none');assert.equal(details.style.filter,'none');assert.equal(details.style.opacity,'1');
 return details;
}
try {
 browser=await playwright.chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
 const contexts=await Promise.all([0,1,2].map(()=>browser.newContext({viewport:{width:1920,height:1080}})));
 const [tv,g,r]=await Promise.all(contexts.map(c=>c.newPage()));
 for(const p of [tv,g,r])p.on('pageerror',e=>errors.push(e.message));
 await tv.goto(base+'/gallery');await g.goto(base+'/scan/green');await r.goto(base+'/scan/red');
 await Promise.all([tv,g,r].map(connected));
 for(const file of ['autumn-woods.png','woodland-sprites.png','woodland-cover.svg']){
  const response=await tv.request.get(base+'/assets/'+file);assert.equal(response.status(),200);
  await tv.evaluate(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src=src;}),'/assets/'+file);
 }
 assert.equal(await tv.locator('#sound').getAttribute('aria-pressed'),'false');
 assert.equal(await tv.locator('#setup-dialog').isVisible(),false);
 await tv.locator('#how-to').click();await tv.locator('#help-dialog').waitFor({state:'visible'});await tv.keyboard.press('Escape');
 await capture(tv,'01-woodland-lobby');
 await g.locator('#player-name').fill('Grace');await g.locator('#name-form button').click();
 await r.locator('#player-name').fill('Rowan');await r.locator('#name-form button').click();
 await tv.locator('[data-setup]').click();await tv.waitForFunction(()=>document.querySelector('#name-red').value==='Rowan');
 await capture(tv,'02-camp');await tv.locator('#start').click();
 await tv.locator('#banner').waitFor({state:'hidden'});assert.equal(await tv.locator('#setup-dialog').isVisible(),false);
 assert.equal(await tv.locator('#scan-patch').isVisible(),false,'Approaching animals have no visible QR');
 assert.equal(await tv.locator('img#animal-code').count(),1,'There is only one QR image in the TV markup');
 await g.bringToFront();await g.locator('#arm').click();await g.keyboard.type('TKY1');await g.keyboard.press('Enter');
 await g.waitForFunction(()=>document.querySelector('#last-scan').textContent.includes('inactive'));
 assert.equal(runtime.game.players.green.score,0,'Hidden animals cannot score');
 await reveal(tv);const first=await assertScanArea(tv,440);
 const before=await tv.locator('#creature').evaluate(n=>getComputedStyle(n).transform);
 await tv.waitForTimeout(180);
 assert.equal(await tv.locator('#creature').evaluate(n=>getComputedStyle(n).transform),before,'The reveal pose does not drift');
 await capture(tv,'03-gobbler-reveal');
 await g.keyboard.type('TKY1');await g.keyboard.press('Enter');
 await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='10');
 assert.equal(await tv.locator('#scan-patch').isVisible(),false,'Lethal damage hides the QR in the message handler');
 await capture(tv,'04-feather-hit');
 await reveal(tv,'TKY4');await assertScanArea(tv,440);await capture(tv,'05-tom-reveal');
 await g.keyboard.type('TKY4');await g.keyboard.press('Enter');
 await tv.waitForFunction(()=>document.querySelector('#creature').dataset.hp==='3');
 assert.equal(await tv.locator('#green-score').textContent(),'35');
 assert.equal(await tv.locator('#damage').evaluate(n=>n.getBoundingClientRect().bottom<=document.querySelector('#animal-code').getBoundingClientRect().top),true,'Hit feedback stays above the QR');
 await g.locator('#how-to').click();await g.evaluate(()=>document.querySelector('#help-dialog').focus());
 await g.keyboard.type('TKY4');await g.keyboard.press('Enter');assert.equal(runtime.game.targets[1].hp,3,'Help pauses scanner capture');
 await g.keyboard.press('Escape');await g.locator('#arm').click();await g.keyboard.type('TKY4');await g.keyboard.press('Enter');
 await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='60');
 await r.bringToFront();await r.locator('#arm').click();await r.keyboard.type('TKY4');await r.keyboard.press('Enter');
 await tv.waitForFunction(()=>document.querySelector('#red-score').textContent==='25');
 assert.equal(await tv.locator('#creature').getAttribute('data-hp'),'1');
 await r.locator('#simulator summary').click();await r.locator('#duplicate').click();await r.waitForFunction(()=>document.querySelector('#last-scan').textContent.includes('duplicate'));
 assert.equal(runtime.game.targets[1].hp,1);
 // Expiration hides the QR locally even before a concealment packet arrives.
 await tv.clock.install();await tv.clock.fastForward(15000);assert.equal(await tv.locator('#scan-patch').isVisible(),false);await tv.clock.resume();
 await move(runtime.game.encounter.concealAt);assert.equal(runtime.game.targets[1].active,false);
 await r.locator('[data-sim=TKY4]').click();await r.waitForFunction(()=>document.querySelector('#last-scan').textContent.includes('inactive'));
 await move(runtime.game.encounter.nextAt);await reveal(tv,'TKY4');
 assert.equal(runtime.game.targets[1].hp,1,'Partial damage survives hiding and returning');
 await r.locator('[data-sim=TKY4]').click();await tv.waitForFunction(()=>document.querySelector('#creature').dataset.hp==='0');
 await reveal(tv,'BEAR');await assertScanArea(tv,440);await capture(tv,'06-bear-reveal');
 for(const client of runtime.io.clients)if(client.data.color==='red')client.close();
 await connected(r);await r.waitForFunction(()=>document.querySelector('#round-status').textContent.includes('50 points'));
 await r.locator('[data-sim=BEAR]').click();await tv.waitForFunction(()=>document.querySelector('#red-score').textContent==='90');
 await tv.waitForFunction(()=>document.querySelector('#diagnostic').textContent.includes('server receipt'));
 console.log('Browser software diagnostic:',await tv.locator('#diagnostic').textContent());
 // Join a second TV during the same encounter; both see the same single code.
 const otherTV=await contexts[0].newPage();await otherTV.goto(base+'/gallery');await connected(otherTV);
 await otherTV.locator('#scan-patch').waitFor({state:'visible'});assert.equal(await otherTV.locator('#creature').getAttribute('data-code'),'BEAR');await assertScanArea(otherTV,440);await otherTV.close();
 for(const client of runtime.io.clients)if(client.data.role==='gallery')client.close();
 await tv.locator('#scan-patch').waitFor({state:'hidden'});await connected(tv);await tv.locator('#scan-patch').waitFor({state:'visible'});
 assert.equal(await tv.locator('#creature').getAttribute('data-code'),'BEAR');
 // Every route stays inside the TV at both common workstation and TV resolutions.
 await tv.setViewportSize({width:1440,height:900});await assertScanArea(tv,370);await capture(tv,'07-tv-1440');
 await tv.setViewportSize({width:1920,height:1080});await tv.bringToFront();await tv.locator('#fullscreen').click();
 await tv.waitForFunction(()=>Boolean(document.fullscreenElement));await assertScanArea(tv,440);
 assert.equal(await tv.evaluate(()=>document.querySelector('.arena').getBoundingClientRect().bottom<=innerHeight),true);
 await capture(tv,'08-fullscreen-hunt');
 // The deadline works while camp is open, and the result dialog is usable afterward.
 await tv.locator('#camp').click();await move(runtime.game.endsAt);
 await tv.waitForFunction(()=>document.querySelector('#phase').textContent==='ROUND COMPLETE');
 await tv.waitForFunction(()=>document.querySelector('[data-next]')?.disabled===false);
 assert.equal(await tv.locator('#setup-dialog').isVisible(),false);assert.equal(await tv.locator('#scan-patch').isVisible(),false);
 assert.match(await tv.locator('#board').textContent(),/Rowan/);await capture(tv,'09-results');
 await tv.locator('[data-next]').click();await tv.locator('#setup-dialog').waitFor({state:'visible'});
 assert.equal(await tv.locator('#green-score').textContent(),'0');assert.equal(await tv.locator('#name-green').inputValue(),'');
 await tv.locator('#close-setup').click();await tv.locator('#fullscreen').click();await tv.waitForFunction(()=>!document.fullscreenElement);await tv.locator('#camp').click();
 await g.bringToFront();await g.locator('#player-name').focus();await g.waitForFunction(()=>document.querySelector('#capture-status').textContent.includes('Editing'));
 await tv.locator('#name-green').fill('Grace');await tv.locator('#name-red').fill('Rowan');
 await tv.locator('[data-mode=alternating]').click();await tv.locator('#chosen-color').selectOption('red');await tv.locator('#start').click();
 await reveal(tv,'TKY4');assert.equal(runtime.game.turn,'red');
 await g.locator('#simulator summary').click();await g.locator('[data-sim=TKY4]').click();await g.waitForFunction(()=>document.querySelector('#last-scan').textContent.includes('Wait for your turn'));
 await r.locator('[data-sim=TKY4]').click();await tv.waitForFunction(()=>document.querySelector('#red-score').textContent==='25');
 await move(runtime.game.startedAt+15000);await tv.waitForFunction(()=>document.querySelector('#phase').textContent.startsWith('GREEN TURN'));
 await g.locator('[data-sim=TKY4]').click();await tv.waitForFunction(()=>document.querySelector('#green-score').textContent==='25');
 await tv.locator('#finish').click();await tv.waitForFunction(()=>document.querySelector('[data-next]')?.disabled===false);
 assert.match(await tv.locator('#banner').textContent(),/fowl tie/);await tv.locator('[data-next]').click();
 await tv.locator('[data-mode=single]').click();await tv.locator('#chosen-color').selectOption('red');
 assert.equal(await tv.locator('#name-green').isDisabled(),true);await tv.locator('#name-red').fill('<b>Feather Boss</b>');await tv.locator('#start').click();
 await reveal(tv,'BEAR');await r.locator('[data-sim=BEAR]').click();await tv.waitForFunction(()=>document.querySelector('#red-score').textContent==='40');
 const reduced=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 const reducedTV=await reduced.newPage();await reducedTV.goto(base+'/gallery');await connected(reducedTV);await reducedTV.locator('#scan-patch').waitFor({state:'visible'});
 assert.equal(await reducedTV.locator('.falling-leaves').evaluate(e=>getComputedStyle(e).display),'none');
 assert.match(await reducedTV.locator('#creature').evaluate(e=>getComputedStyle(e).transform),/^matrix\(/,'Reduced motion has no perspective transform');
 await assertScanArea(reducedTV,440);await reduced.close();
 await r.setViewportSize({width:390,height:844});await capture(r,'10-scanner-mobile');
 for(const p of [tv,r])assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await tv.locator('#finish').click();await tv.waitForFunction(()=>document.querySelector('[data-next]')?.disabled===false);
 assert.match(await tv.locator('.winner-title').textContent(),/<b>Feather Boss<\/b>/);assert.equal(await tv.locator('.winner-title b').count(),0);
 // Inspect all eight consecutive encounters, including the leftmost Gobbler,
 // at TV, workstation, and phone sizes rather than only the center pose.
 await tv.locator('[data-next]').click();await tv.locator('#name-green').fill('Layout G');await tv.locator('#name-red').fill('Layout R');await tv.locator('#start').click();
 for(let i=0;i<8;i++){
  await tv.setViewportSize({width:1920,height:1080});await reveal(tv);await assertScanArea(tv,440);
  await tv.setViewportSize({width:1440,height:900});await assertScanArea(tv,370);
  await tv.setViewportSize({width:390,height:844});await assertScanArea(tv);
  if(i===0)await capture(tv,'11-gallery-mobile');
  assert.equal(await tv.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await move(runtime.game.encounter.nextAt);
 }
 await tv.setViewportSize({width:1920,height:1080});await tv.locator('#finish').click();await tv.waitForFunction(()=>document.querySelector('[data-next]')?.disabled===false);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: one large body code; depth approach, peek, dodge, reveal, retreat; stable square QR; immediate clear; hide rejection; retained damage; repeated Enter scans; duplicate delivery; help isolation; reconnect; second TV; deadline; camp; saved results; resets; alternating and solo; fullscreen; reduced motion; escaped names; responsive capture.');
}finally{await browser?.close();await runtime.close();await rm(dir,{recursive:true,force:true});}
