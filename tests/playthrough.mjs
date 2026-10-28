import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {levels} from '../src/levels.js';
import {solve,move,clone,actions,won,createState} from '../src/model.js';
const base=process.env.GAME_URL||'http://127.0.0.1:5198/';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function perform(a){await page.locator(`[data-source="${a.source.type}-${a.source.index}"]`).click();await page.locator(`[data-target="${a.target.type}-${a.target.index}"]`).click();}
await page.goto(base);await page.locator('#start-btn').waitFor();await page.screenshot({path:'artifacts/home-desktop.png',fullPage:true});
await page.locator('#start-btn').click();await page.locator('#accept-order').click();
await page.locator('[data-source="rail-0"]').click();await page.locator('[data-target="order-1"]').click();assert.equal((await read()).state.moves,0);
await page.locator('[data-target="buffer-0"]').click();assert.equal((await read()).state.buffer[0],0);
await page.locator('[data-source="buffer-0"]').click();await page.locator('[data-target="order-0"]').click();assert.equal((await read()).state.orders[0][0],0);
await page.locator('#undo-btn').click();await page.keyboard.press('z');assert.deepEqual((await read()).state,createState(levels[0]));
// Actual pointer drag must transfer exactly once, and undo must restore the whole move.
const s=await page.locator('[data-source="rail-0"]').boundingBox(),t=await page.locator('[data-target="order-0"]').boundingBox();
await page.mouse.move(s.x+s.width/2,s.y+s.height/2);await page.mouse.down();await page.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:8});await page.mouse.up();assert.equal((await read()).state.moves,1);await page.locator('#undo-btn').click();
await page.locator('[data-source="rail-0"]').press('Enter');await page.locator('[data-target="order-0"]').press('Enter');assert.equal((await read()).state.moves,1);await page.keyboard.press('z');assert.deepEqual((await read()).state,createState(levels[0]));
await page.locator('#help-btn').click();await page.keyboard.press('Escape');assert.equal((await read()).modal,false);
await page.locator('#sound-btn').click();assert.equal(await page.locator('#sound-btn').getAttribute('aria-pressed'),'false');
await page.screenshot({path:'artifacts/play-desktop.png',fullPage:true});
for(let i=0;i<12;i++){
 let info=await read();assert.equal(info.level,i+1);
 if(i===1){
  const first=solve(info.state,levels[i])[0];await perform(first);const saved=(await read()).state;
  await page.reload();await page.locator('#start-btn').click();assert.deepEqual((await read()).state,saved);await page.locator('#undo-btn').click();assert.deepEqual((await read()).state,createState(levels[i]));
  // Exercise an actual dead end, then undo and restart.
  const seen=new Set();function blocked(s,path=[]){if(path.length>14)return null;const key=JSON.stringify([s.rails,s.orders,s.buffer]);if(seen.has(key))return null;seen.add(key);const aa=actions(s,levels[i]);if(!aa.length&&!won(s,levels[i]))return path;for(const a of aa){const p=blocked(move(s,levels[i],a.source,a.target),[...path,a]);if(p)return p;}return null;}
  const bad=blocked(createState(levels[i]));if(bad){for(const a of bad)await perform(a);assert.match(await page.locator('#instruction').textContent(),/没有可走/);await page.screenshot({path:'artifacts/blocked.png',fullPage:true});await page.locator('#undo-btn').click();assert.ok(actions((await read()).state,levels[i]).length);}
  await page.locator('#restart-btn').click();await page.locator('#confirm-reset').click();
  await page.locator('#hint-btn').click();assert.ok((await read()).hint);await page.locator('#undo-btn').isDisabled();
 }
 info=await read();const path=solve(info.state,levels[i]);assert.ok(path);
 const coinsBefore=info.coins;
 for(const a of path)await perform(a);
 const cleared=await read();assert.equal(cleared.mode,'complete');assert.ok(cleared.completed.includes(i));assert.ok(cleared.coins>coinsBefore);assert.match(await page.locator('.coin-settlement').innerText(),/\+\d+/);assert.match(await page.locator('.coin-total').innerText(),/累计金币\s+\d+/);
 await page.locator('#next-order').waitFor();
 if(i===3||i===11)await page.screenshot({path:`artifacts/reward-${i+1}.png`,fullPage:true});
 if(i<11){await page.locator('#next-order').click();await page.locator('#accept-order').click();}
}
await page.locator('#next-order').click();assert.equal((await read()).completed.length,12);await page.screenshot({path:'artifacts/collection.png',fullPage:true});
await page.getByRole('button',{name:'关闭窗口'}).click();await page.reload();await page.locator('#collection-home').click();assert.equal(await page.locator('.gallery-item.done').count(),12);
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),mp=await mobile.newPage();
mp.on('pageerror',e=>errors.push(String(e)));mp.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mp.goto(base);await mp.locator('#start-btn').waitFor();await mp.screenshot({path:'artifacts/home-mobile.png',fullPage:true});await mp.locator('#start-btn').tap();await mp.locator('#accept-order').tap();
const box=await mp.locator('[data-source="rail-0"]').boundingBox();assert.ok(box.width>=40,`mobile target ${box.width}`);
await mp.locator('[data-source="rail-0"]').tap();await mp.locator('[data-target="buffer-0"]').tap();
assert.equal(await mp.evaluate(()=>JSON.parse(window.render_game_to_text()).state.moves),1);
await mp.waitForTimeout(350);await mp.screenshot({path:'artifacts/play-mobile.png',fullPage:true});
assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await mp.setViewportSize({width:900,height:650});assert.equal(await mp.evaluate(()=>JSON.parse(window.render_game_to_text()).state.moves),1);await mp.locator('[data-source="buffer-0"]').click();await mp.locator('[data-target="order-0"]').click();assert.equal(await mp.evaluate(()=>JSON.parse(window.render_game_to_text()).state.moves),2);
await mp.reload();await mp.locator('#start-btn').click();assert.equal(await mp.evaluate(()=>JSON.parse(window.render_game_to_text()).state.moves),2);
await mp.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),extension=gl.getExtension('WEBGL_lose_context');extension.loseContext();setTimeout(()=>extension.restoreContext(),150);});
await mp.getByText('工作台已恢复。',{exact:true}).waitFor();assert.equal(await mp.evaluate(()=>JSON.parse(window.render_game_to_text()).state.moves),2);
await browser.close();assert.deepEqual(errors,[]);console.log('PASS: 12 full commissions, ending, collection, pointer drag, tap, undo, hint, blocked recovery, restart, reload save and responsive resize; no browser errors.');
