import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchLevels,createMatchState,placeMatch} from '../src/match-model.js';
const base=process.env.GAME_URL||'http://127.0.0.1:5220/';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[];
try{
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const read=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
const settle=()=>page.waitForFunction(()=>{const s=JSON.parse(render_game_to_text());return !s.busy&&!s.feedback.flights&&!s.feedback.impacts;});
const click=s=>page.locator(s).click();
const box=async s=>{const b=await page.locator(s).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
await page.goto(base);await click('#start-btn');await click('#accept-order');
const initial=(await read()).state,from=await box('[data-source="palette-2"]'),to=await box('[data-target="slot-13"]');
await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});assert.equal((await read()).feedback.dragging,true);await page.screenshot({path:'artifacts/match-drag.png',fullPage:true});await page.mouse.up();
assert.deepEqual((await read()).state,placeMatch(initial,matchLevels[0],{type:'palette',index:2},{type:'slot',index:13}).state);await settle();await click('#undo-btn');assert.deepEqual((await read()).state,initial);
await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();await settle();assert.deepEqual((await read()).state,initial);
await click('[data-source="palette-2"]');await click('[data-target="slot-13"]');await click('#undo-btn');const eventCount=(await read()).audio.events;await page.waitForTimeout(1000);assert.equal((await read()).audio.events,eventCount);assert.deepEqual((await read()).state,initial);
// Normal-motion circular mixed-shade clear, animated refill and undo use a valid saved position.
const state=createMatchState(matchLevels[11]);state.rings[0]=[0,6,1,2,3,4,5,1];
await page.evaluate(save=>localStorage.setItem('old-beads-pink-v1',JSON.stringify(save)),{version:1,completed:[],coins:0,matchSession:{mode:'match-v1',level:11,state,history:[]}});
await page.reload();await click('#start-btn');await page.locator('[data-target="slot-0"]').waitFor();await click('[data-source="palette-0"]');await click('[data-target="slot-2"]');assert.equal((await read()).state.collected[0],2);await page.waitForTimeout(360);await page.screenshot({path:'artifacts/match-clearing.png',fullPage:true});await settle();assert.deepEqual((await read()).state,placeMatch(state,matchLevels[11],{type:'palette',index:0},{type:'slot',index:2}).state);await page.screenshot({path:'artifacts/match-refilled.png',fullPage:true});await click('#undo-btn');assert.deepEqual((await read()).state,state);
await click('#audio-settings');await page.locator('#music-toggle').uncheck();await page.locator('#volume-slider').fill('40');await page.locator('#sound-toggle').uncheck();await click('#modal .modal-close');const muted=(await read()).audio.events;await click('[data-source="palette-2"]');await click('[data-target="slot-14"]');await settle();assert.equal((await read()).audio.events,muted);
const sourceAudio=fs.readFileSync('src/audio.js','utf8');
const rendered=await page.evaluate(async code=>{
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),{synthesize,MATERIALS}=await import(url);URL.revokeObjectURL(url);
  const profiles=[];
  for(let color=0;color<MATERIALS.length;color++){
    const ctx=new OfflineAudioContext(2,44100,44100);synthesize(ctx,ctx.destination,'land',{color},.02);const b=await ctx.startRendering(),data=b.getChannelData(0);
    let peak=0,energy=0,tail=0,signature=0;for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));energy+=data[i]**2;if(i>22050)tail+=data[i]**2;signature+=data[i]*Math.cos(i*.13);}
    profiles.push({peak,rms:Math.sqrt(energy/data.length),tail,signature});
  }
  const ctx=new OfflineAudioContext(2,44100*8,44100);
  synthesize(ctx,ctx.destination,'launch',{},.01);
  for(let color=0;color<10;color++)synthesize(ctx,ctx.destination,'land',{color,pan:(color-4.5)*.11},.15+color*.55);
  synthesize(ctx,ctx.destination,'land',{color:2,target:'buffer'},5.1);synthesize(ctx,ctx.destination,'thread',{},6.1);
  const b=await ctx.startRendering();return {profiles,channels:[Array.from(b.getChannelData(0)),Array.from(b.getChannelData(1))]};
},sourceAudio);
for(const p of rendered.profiles){assert.ok(p.peak>.02&&p.peak<.8);assert.ok(p.rms>.001);assert.ok(p.tail<.00001);}
assert.equal(new Set(rendered.profiles.map(p=>p.signature.toFixed(4))).size,24);
const length=rendered.channels[0].length,wav=Buffer.alloc(44+length*4);
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(176400,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(length*4,40);
for(let i=0;i<length;i++)for(let c=0;c<2;c++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,rendered.channels[c][i]))*32767),44+i*4+c*2);
fs.writeFileSync('artifacts/bead-sound-demo.wav',wav);fs.writeFileSync('artifacts/audio-check.json',JSON.stringify(rendered.profiles,null,2));

const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(base);await mp.locator('#start-btn').tap();await mp.locator('#accept-order').tap();
await mp.locator('#board').scrollIntoViewIfNeeded();const a=await mp.locator('[data-source="palette-2"]').boundingBox(),b=await mp.locator('[data-target="slot-11"]').boundingBox(),touch=await mobile.newCDPSession(mp),start={x:a.x+a.width/2,y:a.y+a.height/2},end={x:b.x+b.width/2,y:b.y+b.height/2};
await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});for(let i=1;i<=8;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/8,y:start.y+(end.y-start.y)*i/8}]});assert.equal(await mp.evaluate(()=>JSON.parse(render_game_to_text()).feedback.dragging),true);await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await mp.waitForTimeout(500);assert.equal(await mp.evaluate(()=>JSON.parse(render_game_to_text()).state.moves),0);
await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});for(let i=1;i<=8;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/8,y:start.y+(end.y-start.y)*i/8}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await mp.evaluate(()=>JSON.parse(render_game_to_text()).state.moves),1);await mp.waitForTimeout(1000);await mp.locator('#undo-btn').tap();await mp.waitForFunction(()=>JSON.parse(render_game_to_text()).state.moves===0);
await mp.setViewportSize({width:900,height:650});await mp.waitForTimeout(150);await mp.locator('[data-source="palette-1"]').tap();await mp.locator('[data-target="slot-15"]').tap();assert.equal(await mp.evaluate(()=>JSON.parse(render_game_to_text()).state.moves),1);await mp.waitForTimeout(950);
await mp.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_lose_context');ext.loseContext();setTimeout(()=>ext.restoreContext(),150);});await mp.getByText('工作台已恢复。',{exact:true}).waitFor();assert.equal(await mp.evaluate(()=>JSON.parse(render_game_to_text()).state.moves),1);
assert.deepEqual(errors,[]);console.log('PASS: mouse/touch drag, cancel, arbitrary replacement, mixed clear animation/refill, undo during flight, mute, material audio, rotation and WebGL restore.');
}finally{await browser.close();}
