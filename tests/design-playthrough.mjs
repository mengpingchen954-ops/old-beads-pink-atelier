import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.GAME_URL||'http://127.0.0.1:5198/';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const errors=[];
try{for(const mobile of [false,true]){
 const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}:{viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
 const click=async selector=>mobile?page.locator(selector).tap():page.locator(selector).click();
 const put=async(i,c)=>{await click(`[data-material="${c}"]`);await click(`[data-slot="${i}"]`);};
 await page.goto(base);await click('#start-btn');await click('#accept-order');await click('[data-source="rail-0"]');await click('[data-target="buffer-0"]');
 const old=(await read()).state;await click('#go-home');
 await page.screenshot({path:`artifacts/design-home-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await click('#design-home-entry');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);
 assert.deepEqual((await read()).design.slots,Array(12).fill(null));await click('[data-slot="0"]');assert.equal((await read()).design.slots[0],4);await click('#design-undo');
 await click('#design-submit');assert.equal((await read()).modal,false);assert.match(await page.locator('#design-status').textContent(),/还差一点/);
 // Exhaust a material, recover it, undo and reset through actual controls.
 for(const i of [2,3,4,5])await put(i,4);await put(6,4);assert.equal((await read()).design.slots[6],null);
 await put(2,'remove');await put(6,4);assert.equal((await read()).design.slots[6],4);
 await click('#design-undo');assert.equal((await read()).design.slots[6],null);
 await click('#design-reset');await click('#design-confirm-reset');assert.equal((await read()).design.slots.filter(c=>c!==null).length,0);
 await put(2,4);await put(10,4);const partial=(await read()).design.slots;
 await page.reload();await click('#design-home-entry');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);assert.deepEqual((await read()).design.slots,Array(12).fill(null));await click('#design-resume');assert.deepEqual((await read()).design.slots,partial);
 for(const [i,c] of [[0,3],[1,3],[11,3],[3,7],[9,7],[4,5],[8,5],[5,4],[7,4],[6,0]])await put(i,c);
 assert.ok((await read()).design.checks.every(r=>r.ok));
 await page.waitForTimeout(850);await page.screenshot({path:`artifacts/design-play-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 if(!mobile){
  await page.setViewportSize({width:560,height:900});await page.waitForTimeout(100);assert.equal((await read()).design.targets.length,12);await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(async()=>{const canvas=document.querySelector('canvas'),ext=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');ext.loseContext();await new Promise(r=>setTimeout(r,100));ext.restoreContext();});await page.waitForTimeout(300);
  assert.deepEqual((await read()).design.slots,[3,3,4,7,5,4,0,4,5,7,4,3]);
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await click('#design-submit');assert.equal((await read()).coins,240);assert.ok((await read()).design.rewarded);
 await page.waitForTimeout(1000);await page.screenshot({path:`artifacts/design-reward-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await click('#design-display');assert.ok(await page.locator('[data-tray="gold"]').isDisabled());await click('[data-tray="azure"]');assert.equal((await read()).coins,60);assert.equal((await read()).design.tray,'azure');
 await click('[data-tray="azure"]');assert.equal((await read()).coins,60);
 await page.screenshot({path:`artifacts/design-showcase-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await click('#showcase-design');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);
 // A second valid answer changes the actual saved creation without duplicate reward.
 assert.deepEqual((await read()).design.slots,Array(12).fill(null));await click('#design-resume');
 for(const [i,c] of [[2,7],[10,7],[3,4],[9,4]])await put(i,c);
 assert.ok((await read()).design.checks.every(r=>r.ok));await click('#design-submit');assert.equal((await read()).coins,60);assert.match(await page.locator('.coin-settlement strong').textContent(),/更新/);
 await click('#modal .modal-close');await click('#design-home');assert.equal(await page.locator('.home-custom .design-bracelet img').count(),12);await page.screenshot({path:`artifacts/design-home-showcase-${mobile?'mobile':'desktop'}.png`,fullPage:true});await click('#start-btn');assert.deepEqual((await read()).state,old);
 await click('#go-home');await page.reload();await click('#showcase-home');assert.equal(await page.locator('.showcase-tray.tray-azure').count(),1);
 await click('#showcase-design');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);assert.equal((await read()).coins,60);assert.deepEqual((await read()).design.savedDesign,[3,3,7,4,5,4,0,4,5,4,7,3]);
 await click('#design-sound');assert.equal((await read()).audio.enabled,false);
 await context.close();
}
 assert.deepEqual(errors,[]);console.log('Design loop passed: desktop, touch, draft resume, multiple answers, rewards, purchases, legacy save, resize/context restore; no browser errors.');
}finally{await browser.close();}
