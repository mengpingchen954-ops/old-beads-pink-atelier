import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchLevels,placeMatch,matchWon,createMatchState} from '../src/match-model.js';
const base=process.env.GAME_URL||'http://127.0.0.1:5220/';
fs.mkdirSync('artifacts',{recursive:true});const browser=await chromium.launch({headless:true}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 const read=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
 async function act(color,index){const before=(await read()).state,expected=placeMatch(before,matchLevels[(await read()).level-1],{type:'palette',index:color},{type:'slot',index});await page.locator(`[data-source="palette-${color}"]`).click();await page.locator(`[data-target="slot-${index}"]`).click();assert.deepEqual((await read()).state,expected.state);}
 await page.goto(base);await page.locator('#start-btn').click();await page.locator('#accept-order').click();assert.equal(await page.locator('[data-target]').count(),16);
 const initial=(await read()).state;await act(2,14);await page.locator('#undo-btn').click();assert.deepEqual((await read()).state,initial);
 await page.locator('[data-source="palette-1"]').press('Enter');await page.locator('[data-target="slot-11"]').press('Enter');assert.equal((await read()).state.moves,1);await page.keyboard.press('z');assert.deepEqual((await read()).state,initial);
 await page.locator('#hint-btn').click();assert.ok((await read()).hint);await page.locator('#help-btn').click();assert.match(await page.locator('.help-list').innerText(),/首尾相邻/);await page.keyboard.press('Escape');
 for(let level=0;level<12;level++){
  assert.equal((await read()).level,level+1);const spec=matchLevels[level];
  if(level===3||level===11){await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:`artifacts/match-level-${level+1}.png`,fullPage:true});}
  if(level===1){await act(1,13);const saved=(await read()).state;await page.reload();await page.locator('#start-btn').click();await page.locator('[data-target="slot-0"]').waitFor();assert.deepEqual((await read()).state,saved);await page.locator('#undo-btn').click();assert.deepEqual((await read()).state,createMatchState(spec));}
  let guard=0;while(!matchWon((await read()).state,spec)){assert.ok(++guard<160);const state=(await read()).state,goal=spec.goals.find(g=>state.collected[g.color]<g.count);for(let slot=0;slot<3&&!matchWon((await read()).state,spec);slot++)await act(goal.color,slot);}
  const info=await read();assert.equal(info.mode,'complete');assert.ok(info.completed.includes(level));await page.locator('#next-order').waitFor();assert.match(await page.locator('.match-reward-summary').innerText(),/✓/);assert.equal(await page.locator('.reward-bracelets img').count(),16);
  if(level===0||level===11)await page.screenshot({path:`artifacts/match-reward-${level+1}.png`,fullPage:true});
  await page.locator('#next-order').click();if(level<11)await page.locator('#accept-order').click();console.log('PASS collection level',level+1);
 }
 assert.equal((await read()).completed.length,12);await page.locator('#modal .modal-close').click();const total=(await read()).coins;assert.equal((await read()).construction.available,12);
 await page.reload();assert.equal((await read()).coins,total);await page.locator('#collection-home').click();assert.equal(await page.locator('.gallery-item.done').count(),12);assert.equal(await page.locator('[data-level="0"] img').count(),8);await page.locator('#modal .modal-close').click();
 for(let i=0;i<12;i++){await page.locator('#build-home').click();await page.locator('#confirm-build').click();assert.equal((await read()).construction.repaired,i+1);if(i===3||i===7)await page.locator('#visit-area').click();}
 assert.equal((await read()).construction.available,0);await page.reload();assert.equal((await read()).construction.repaired,12);assert.deepEqual(errors,[]);
 console.log('PASS: all 12 collection levels through real UI, keyboard, undo, hint, refill, save/resume, actual bracelet gallery and construction rewards.');
}finally{await browser.close();}
