import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchLevels,createMatchState,placeMatch} from '../src/match-model.js';
const base=process.env.GAME_URL||'http://127.0.0.1:5220/';
fs.mkdirSync('artifacts',{recursive:true});const errors=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});try{
 for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[700,900],[844,390]]){
  const tag=`${engine.name()}-${width}`,context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(`${tag}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${tag}: ${m.text()}`);});page.on('response',r=>{if(r.status()>=400)errors.push(`${tag}: ${r.status()} ${r.url()}`);});
  const read=()=>page.evaluate(()=>JSON.parse(render_game_to_text())),tap=s=>page.locator(s).tap();
  const fits=async()=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(await page.locator('.modal').count())assert.ok(await page.locator('.modal').evaluate(e=>e.scrollWidth<=e.clientWidth));};
  async function targets(){assert.equal(await page.locator('[data-target]').count(),16);assert.equal(await page.locator('#match-materials button').count(),(await read()).palette.length);assert.ok(await page.locator('.board-hit,#match-materials button').evaluateAll(es=>es.every(e=>{const b=e.getBoundingClientRect();return b.width>=43.9&&b.height>=43.9;})));await page.locator('#board').scrollIntoViewIfNeeded();assert.ok(await page.locator('.board-hit').evaluateAll(es=>es.every(e=>{const b=e.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e;})),'each bead center selects its own slot');}
  await page.goto(base);await tap('#start-btn');await tap('#accept-order');await fits();await targets();
  const initial=(await read()).state;await tap('[data-source="palette-2"]');await tap('[data-target="slot-14"]');assert.deepEqual((await read()).state,placeMatch(initial,matchLevels[0],{type:'palette',index:2},{type:'slot',index:14}).state);await tap('#undo-btn');assert.deepEqual((await read()).state,initial);
  for(let i=0;i<16;i++){await tap('[data-source="palette-1"]');await tap(`[data-target="slot-${i}"]`);assert.equal((await read()).state.moves,1);await tap('#undo-btn');}
  await page.locator('#sound-btn').scrollIntoViewIfNeeded();const song=(await read()).audio.track;await tap('#sound-btn');await page.waitForTimeout(470);assert.notEqual((await read()).audio.track,song);const next=(await read()).audio.track;await tap('#sound-btn');await tap('#sound-btn');await page.locator('#volume-slider').waitFor();assert.equal((await read()).audio.track,next);await fits();await page.locator('#music-volume-slider').fill('24');assert.equal((await read()).audio.musicVolume,.24);await tap('#modal .modal-close');
  await tap('#go-home');await tap('#design-home-entry');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);await tap('[data-filter="gem"]');await tap('[data-filter="all"]');assert.equal((await read()).design.selectedColor,4);await tap('[data-slot="0"]');assert.equal((await read()).design.slots[0],4);await tap('#design-home');
  const state=createMatchState(matchLevels[11]);state.rings[0]=[0,6,1,2,3,4,5,1];
  await page.evaluate(save=>localStorage.setItem('old-beads-pink-v1',JSON.stringify(save)),{version:1,completed:Array.from({length:11},(_,i)=>i),coins:1000,sound:true,matchSession:{mode:'match-v1',level:11,state,history:[]}});
  await page.reload();await tap('#start-btn');await page.locator('[data-target="slot-0"]').waitFor();await page.locator('#board').scrollIntoViewIfNeeded();await fits();await targets();await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:`artifacts/match-mobile-${tag}.png`,fullPage:true});
  await tap('[data-source="palette-0"]');await tap('[data-target="slot-2"]');assert.equal((await read()).state.collected[0],2);assert.equal((await read()).state.collected[6],1);assert.deepEqual((await read()).state,placeMatch(state,matchLevels[11],{type:'palette',index:0},{type:'slot',index:2}).state);
  await tap('#undo-btn');assert.deepEqual((await read()).state,state);await tap('[data-source="ring-0"]');await tap('[data-target="slot-13"]');const saved=(await read()).state;assert.equal(saved.moves,1);
  await page.setViewportSize({width:height,height:width});await page.waitForTimeout(150);await fits();await page.reload();await tap('#start-btn');await page.locator('[data-target="slot-0"]').waitFor();assert.deepEqual((await read()).state,saved);await tap('#undo-btn');assert.deepEqual((await read()).state,state);
  await context.close();console.log(`PASS: ${tag}, all 16 slots, any material, mixed clear/count/refill, swap/undo, audio, designer, rotation/save.`);
 }
 }finally{await browser.close();}
}
assert.deepEqual(errors,[]);
// iOS media-element volume is read-only. Verify that real decoded music still has controllable PCM output.
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
  const NativeAudio=window.Audio;window.Audio=function(...args){const p=new NativeAudio(...args);Object.defineProperty(p,'volume',{get:()=>1,set:()=>{}});return p;};
  const native=AudioContext.prototype.createMediaElementSource;AudioContext.prototype.createMediaElementSource=function(...args){
   const source=native.apply(this,args),connect=source.connect.bind(source),ctx=this;
   source.connect=function(gain){const result=connect(gain),meter=ctx.createAnalyser(),silent=ctx.createGain();silent.gain.value=0;gain.connect(meter);meter.connect(silent);silent.connect(ctx.destination);window.__musicMeter=meter;return result;};return source;
  };
 });
 const page=await context.newPage();await page.goto(base);await page.locator('#sound-home').tap();
 await page.locator('#volume-slider').fill('100');await page.locator('#music-volume-slider').fill('100');
 await page.waitForFunction(()=>{if(!window.__musicMeter)return false;const b=new Float32Array(__musicMeter.fftSize);__musicMeter.getFloatTimeDomainData(b);return Math.sqrt(b.reduce((s,x)=>s+x*x,0)/b.length)>.001;});
 await page.locator('#music-volume-slider').fill('0');await page.waitForTimeout(300);
 assert.ok(await page.evaluate(()=>{const b=new Float32Array(__musicMeter.fftSize);__musicMeter.getFloatTimeDomainData(b);return Math.sqrt(b.reduce((s,x)=>s+x*x,0)/b.length)<.00001;}),'music volume must silence actual PCM even with a read-only media volume');
 await page.locator('#music-volume-slider').fill('50');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).audio.musicLevel>.49);
 await context.close();console.log('PASS: actual music PCM is audible, silenced and restored through Web Audio with simulated iOS read-only element volume.');
}finally{await browser.close();}
