import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {levels} from '../src/levels.js';
import {createState,solve} from '../src/model.js';
const base=process.env.GAME_URL||'http://127.0.0.1:5220/';
fs.mkdirSync('artifacts',{recursive:true});
const errors=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[700,900],[844,390]]){
   const tag=`${engine.name()}-${width}`,context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(`${tag}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${tag}: ${m.text()}`);});page.on('response',r=>{if(r.status()>=400)errors.push(`${tag}: ${r.status()} ${r.url()}`);});
   const read=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
   const tap=s=>page.locator(s).tap();
   async function fits(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tag}: page width`);if(await page.locator('#modal').count())assert.ok(await page.locator('.modal').evaluate(e=>e.scrollWidth<=e.clientWidth),`${tag}: modal width`);}
   async function targets(){
    const boxes=await page.locator('.board-hit').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
    for(const b of boxes)assert.ok(b.width>=43.9&&b.height>=43.9,`${tag}: touch target ${b.width}x${b.height}`);
    const rows=await page.locator('[data-source^="rail-"]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
    for(let i=1;i<rows.length;i++)assert.ok(rows[i].top>=rows[i-1].bottom-.1,`${tag}: material targets must not overlap`);
   }
   await page.goto(base);await page.locator('#start-btn').waitFor();await fits();
   if(width<=760)assert.ok((await page.locator('#start-btn').boundingBox()).y+65<=height,`${tag}: start visible without scrolling`);
   await tap('#start-btn');await tap('#accept-order');assert.equal(await page.evaluate(()=>scrollY),0,`${tag}: start at top`);await targets();
   await tap('[data-source="rail-0"]');await tap('[data-target="order-0"]');assert.equal((await read()).state.moves,1);
   await tap('#undo-btn');assert.equal((await read()).state.moves,0);
   await page.locator('#sound-btn').scrollIntoViewIfNeeded();const song=(await read()).audio.track;
   await tap('#sound-btn');await page.waitForTimeout(480);assert.notEqual((await read()).audio.track,song);
   const next=(await read()).audio.track;await tap('#sound-btn');await tap('#sound-btn');await page.locator('#volume-slider').waitFor();await page.waitForTimeout(450);assert.equal((await read()).audio.track,next);await fits();
   const scrollBefore=await page.evaluate(()=>scrollY);
   await page.locator('#volume-slider').scrollIntoViewIfNeeded();const volume=await page.locator('#volume-slider').boundingBox();await page.touchscreen.tap(volume.x+volume.width*.3,volume.y+volume.height/2);assert.ok((await read()).audio.volume<.5,`${tag}: touch volume`);
   await tap('[data-music-track="5"]');assert.equal((await read()).audio.track,'治愈时光');
   await page.locator('#music-toggle').uncheck();assert.equal((await read()).audio.playing,false);await page.locator('#music-toggle').check();
   await page.getByRole('button',{name:'回到工作台',exact:true}).tap();assert.equal((await read()).modal,false);assert.equal(await page.evaluate(()=>scrollY),scrollBefore,`${tag}: modal preserves page scroll`);
   if(width===320){
    for(const a of solve((await read()).state,levels[0])){await tap(`[data-source="${a.source.type}-${a.source.index}"]`);await tap(`[data-target="${a.target.type}-${a.target.index}"]`);}
    await page.locator('#reward-home').waitFor();await page.waitForTimeout(950);await fits();assert.equal(await page.locator('.reward-bracelets .bracelet').count(),2);await page.screenshot({path:`artifacts/mobile-reward-${tag}.png`,fullPage:true});await tap('#reward-home');assert.equal(await page.evaluate(()=>scrollY),0,`${tag}: home at top`);
    await tap('#build-home');await tap('#confirm-build');assert.equal((await read()).construction.repaired,1);
    await tap('#collection-home');await fits();await tap('[data-level="0"]');await fits();await tap('#back-gallery');await tap('#modal .modal-close');
   }else {await tap('#go-home');assert.equal(await page.evaluate(()=>scrollY),0,`${tag}: home at top`);}
   await tap('#design-home-entry');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);await fits();await targets();
   await tap('[data-filter="gem"]');await tap('[data-filter="all"]');assert.equal((await read()).design.selectedColor,4,'filtering must not accidentally select a material under the finger');await tap('[data-slot="0"]');assert.equal((await read()).design.slots[0],4);await tap('#design-undo');assert.equal((await read()).design.slots[0],null);
   await page.screenshot({path:`artifacts/mobile-designer-${tag}.png`,fullPage:true});await tap('#design-home');
   // A valid late-game save exercises all four material rows and filled gallery cells.
   await page.evaluate(save=>localStorage.setItem('old-beads-pink-v1',JSON.stringify(save)),{version:1,completed:Array.from({length:11},(_,i)=>i),coins:1000,sound:true,session:{level:11,state:createState(levels[11]),history:[],usedHint:false}});
   await page.reload();await tap('#collection-home');await fits();await page.screenshot({path:`artifacts/mobile-collection-${tag}.png`,fullPage:true});await tap('#modal .modal-close');
   await tap('#start-btn');assert.equal((await read()).level,12);await targets();await fits();await page.screenshot({path:`artifacts/mobile-four-rails-${tag}.png`,fullPage:true});
   const action=solve((await read()).state,levels[11])[0];await tap(`[data-source="${action.source.type}-${action.source.index}"]`);await tap(`[data-target="${action.target.type}-${action.target.index}"]`);assert.equal((await read()).state.moves,1);
   await page.setViewportSize({width:height,height:width});await page.waitForTimeout(100);assert.equal((await read()).state.moves,1);await fits();
   await page.reload();await tap('#start-btn');assert.equal((await read()).state.moves,1,`${tag}: progress survives rotation and reload`);
   await context.close();console.log(`PASS: ${tag} touch, layout, sound gestures, settings, designer, four rails, gallery, rotation/save`);
  }
  if(engine===webkit)console.log('WebKit WinCairo verified layout, WebGL, MP3 and touch; this runtime does not expose AudioContext, so synthesized sound requires the Chromium check and real-device follow-up.');
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
