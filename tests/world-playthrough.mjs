import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createState,solve} from '../src/model.js';
import {levels} from '../src/levels.js';
const base=process.env.GAME_URL||'http://127.0.0.1:5220/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const read=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
const legacy=JSON.stringify({version:1,completed:[0,1,2,3],coins:4321});
try{
 await page.goto(base);await page.evaluate(value=>localStorage.setItem('old-beads-v1',value),legacy);await page.reload();
 assert.deepEqual((await read()).completed,[]);assert.equal((await read()).coins,0);
 await page.locator('#start-btn').click();await page.locator('#accept-order').click();
 const path=solve(createState(levels[0]),levels[0]);
 async function finish(){for(const a of path){await page.locator(`[data-source="${a.source.type}-${a.source.index}"]`).click();await page.locator(`[data-target="${a.target.type}-${a.target.index}"]`).click();}await page.locator('#reward-home').waitFor();}
 await finish();await page.locator('#reward-home').click();assert.equal((await read()).construction.available,1);assert.equal((await read()).construction.repaired,0);
 const before=await page.locator('.world-frame').innerHTML();
 await page.locator('[data-repair="0"]').click();await page.locator('#confirm-build').click();
 assert.equal((await read()).construction.available,0);assert.equal((await read()).construction.repaired,1);assert.notEqual(await page.locator('.world-frame').innerHTML(),before);
 await page.reload();assert.equal((await read()).construction.repaired,1);assert.equal(await page.evaluate(()=>localStorage.getItem('old-beads-v1')),legacy);
 await page.locator('#map-home').click();await page.locator('[data-map-level="0"]').click();await page.locator('#accept-order').click();await finish();assert.equal((await read()).coins,125);assert.equal((await read()).construction.available,0);
 await page.locator('#reward-home').click();await page.locator('#build-home').click();assert.match(await page.locator('#confirm-build').innerText(),/去赚/);await page.keyboard.press('Escape');
 // Fully earned save fixture checks all scene transitions and visual object layers.
 await page.evaluate(()=>localStorage.setItem('old-beads-pink-v1',JSON.stringify({version:1,completed:Array.from({length:12},(_,i)=>i),coins:2000,construction:{built:4}})));await page.reload();
 await page.locator('[data-area="studio"]').click();assert.equal(await page.locator('[data-restored-part]').count(),0);
 for(let i=4;i<8;i++){await page.locator('#build-home').click();await page.locator('#confirm-build').click();if(i===7)await page.locator('#visit-area').click();else assert.equal(await page.locator('[data-restored-part]').count(),i-3);}
 await page.locator('[data-area="studio"]').click();assert.equal(await page.locator('[data-restored-part]').count(),4);await page.screenshot({path:'artifacts/final-studio.png'});
 await page.locator('[data-area="garden"]').click();await page.screenshot({path:'artifacts/final-garden-before.png'});
 for(let i=8;i<12;i++){await page.locator('#build-home').click();await page.locator('#confirm-build').click();}
 await page.screenshot({path:'artifacts/final-garden.png'});assert.equal((await read()).construction.repaired,12);
 await page.setViewportSize({width:390,height:844});await page.locator('[data-area="shop"]').click();await page.screenshot({path:'artifacts/final-shop-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS: original save isolation, first-clear stars, explicit spending, no replay reward, reload, individual scene parts and all three areas.');
}finally{await browser.close();}
