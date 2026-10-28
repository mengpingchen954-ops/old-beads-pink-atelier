import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.GAME_URL||'http://127.0.0.1:5198/';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const errors=[];
try{for(const mobile of [false,true]){
 const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
 const click=async selector=>mobile?page.locator(selector).tap():page.locator(selector).click();
 const material=async c=>{await click('[data-filter="all"]');await click(`[data-material="${c}"]`);};
 const center=async selector=>{const b=await page.locator(selector).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
 await page.goto(base);await click('#design-home-entry');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);
 assert.equal((await read()).design.materials.length,24);assert.equal(await page.locator('.design-materials img').count(),24);
 await page.locator('.design-materials img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 assert.deepEqual((await read()).design.slots,Array(12).fill(null));
 await page.screenshot({path:`artifacts/empty-start-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await material(3);for(const i of [0,1,11])await click(`[data-slot="${i}"]`);
 await material(4);assert.equal((await read()).design.slots[2],null);await click('#design-launch');
 assert.equal((await read()).design.slots[2],4);assert.ok((await read()).feedback.flights>0);
 await page.waitForTimeout(100);await page.screenshot({path:`artifacts/launch-flight-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 // Rapid launches stay separate and settle without losing or duplicating beads.
 await material(7);await click('#design-launch');await material(5);await click('#design-launch');
 assert.deepEqual((await read()).design.slots.slice(2,5),[4,7,5]);await page.waitForTimeout(1250);assert.equal((await read()).feedback.flights,0);
 const client=await context.newCDPSession(page);
 async function drag(from,to,{cancel=false,escape=false,outside=false}={}){
  await page.locator('#board').scrollIntoViewIfNeeded();const a=await center(`[data-slot="${from}"]`),b=outside?{x:8,y:8}:await center(`[data-slot="${to}"]`);
  if(mobile){
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x:a.x,y:a.y}]});
   for(let i=1;i<=7;i++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:0,x:a.x+(b.x-a.x)*i/7,y:a.y+(b.y-a.y)*i/7}]});await page.waitForTimeout(20);}
   assert.equal((await read()).feedback.dragging,true);
   if(escape)await page.keyboard.press('Escape');
   await client.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
  }else{
   await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});assert.equal((await read()).feedback.dragging,true);
   if(cancel||escape)await page.keyboard.press('Escape');await page.mouse.up();
  }
  await page.waitForTimeout(330);
 }
 let before=(await read()).design.slots;
 await drag(2,5);let s=(await read()).design.slots;assert.equal(s[2],null);assert.equal(s[5],4);
 await drag(3,5);s=(await read()).design.slots;assert.equal(s[3],4);assert.equal(s[5],7);
 assert.deepEqual(s.filter(c=>c!==null).sort(),before.filter(c=>c!==null).sort());
 before=[...s];await drag(3,0);assert.equal((await read()).design.slots[0],4);assert.equal((await read()).design.slots[3],3);await click('#design-undo');assert.deepEqual((await read()).design.slots,before);
 await drag(3,8,{outside:true});assert.deepEqual((await read()).design.slots,before);
 await drag(3,8,{cancel:true});assert.deepEqual((await read()).design.slots,before);assert.equal((await read()).feedback.dragging,false);
 await drag(3,8,{escape:true});assert.deepEqual((await read()).design.slots,before);assert.equal((await read()).feedback.dragging,false);
 // A cancelled drag must not swallow the next gesture.
  await drag(3,8);assert.equal((await read()).design.slots[8],4);assert.equal((await read()).design.slots[3],null);await click('#design-undo');assert.deepEqual((await read()).design.slots,before);
 await click('#design-move');await page.locator('[data-slot="3"]').press('Enter');await page.locator('[data-slot="4"]').press('Enter');assert.equal((await read()).design.slots[4],4);await click('#design-undo');
 await click('[data-filter="charm"]');assert.equal(await page.locator('.design-materials button:visible').count(),4);
 await click('[data-material="20"]');await click('#design-launch');assert.equal((await read()).design.slots[2],20);await click('#design-undo');
 await click('[data-filter="natural"]');await click('[data-material="17"]');await click('#design-launch');assert.equal((await read()).design.slots[2],17);await click('#design-undo');
 // All 24 assets can be loaded into the launcher and placed, including the original locked-bead material.
 for(let color=0;color<24;color++){await material(color);await click('[data-slot="2"]');assert.equal((await read()).design.slots[2],color);}
 await page.waitForTimeout(1250);await page.screenshot({path:`artifacts/launch-library-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await click('#design-reset');await click('#design-confirm-reset');
 const solution=[3,3,10,19,23,22,0,22,23,19,10,3];
 assert.deepEqual((await read()).design.slots,Array(12).fill(null));
 for(let i=0;i<12;i++){await material(solution[i]);await click('#design-launch');}
 assert.deepEqual((await read()).design.slots,solution);assert.ok((await read()).design.checks.every(r=>r.ok));
 await page.waitForTimeout(1250);await page.screenshot({path:`artifacts/launch-complete-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await click('#design-submit');assert.equal((await read()).coins,240);await page.waitForTimeout(700);await page.screenshot({path:`artifacts/launch-reward-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await page.reload();await click('#design-home-entry');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);assert.deepEqual((await read()).design.savedDesign,solution);
 assert.deepEqual((await read()).design.slots,Array(12).fill(null));assert.equal((await read()).design.hasSavedDraft,true);assert.equal((await read()).coins,240);assert.match(await page.locator('#design-count').textContent(),/0 \/ 12/);
 await page.screenshot({path:`artifacts/saved-empty-entry-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await click('#design-resume');assert.deepEqual((await read()).design.slots,solution);
 await click('#design-submit');assert.equal((await read()).coins,240);
 await click('#modal .modal-close');await click('#design-home');await click('#design-home-entry');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);assert.deepEqual((await read()).design.slots,Array(12).fill(null));
 await click('#design-launch');assert.equal((await read()).design.slots.filter(c=>c!==null).length,1);assert.equal((await read()).design.slots[0],4);assert.equal((await read()).coins,240);assert.deepEqual((await read()).design.savedDesign,solution);assert.equal(await page.locator('#design-resume').isVisible(),false);
 await context.close();
}assert.deepEqual(errors,[]);console.log('PASS: 24 jewelry assets, real launches, rapid shots, mouse/touch drag, empty moves, occupied swaps, invalid returns and editable top sites, Escape/touch cancellation, keyboard swap, stock conservation and persisted custom creations; no console errors.');
}finally{await browser.close();}
