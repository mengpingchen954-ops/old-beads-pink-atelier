import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.GAME_URL||'http://127.0.0.1:5198/';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const box=async selector=>{const b=await page.locator(selector).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
const click=selector=>page.locator(selector).click();
const settle=()=>page.waitForFunction(()=>{const f=JSON.parse(window.render_game_to_text()).feedback;return !f.dragging&&!f.flights&&!f.impacts;});
fs.mkdirSync('artifacts',{recursive:true});
await page.goto(base);await click('#start-btn');await click('#accept-order');
const source=await box('[data-source="rail-0"]'),neighbor=await box('[data-source="rail-1"]'),wrong=await box('[data-target="order-1"]'),right=await box('[data-target="order-0"]');
await page.mouse.move(source.x,source.y);await page.mouse.down();await page.mouse.move(neighbor.x,neighbor.y+12,{steps:10});
assert.equal((await read()).feedback.dragging,true);assert.equal((await read()).state.moves,0);assert.ok((await read()).audio.events>=3,'pick plus contact with visible bead');
await page.screenshot({path:'artifacts/feel-drag.png'});
await page.mouse.move(wrong.x,wrong.y,{steps:8});await page.mouse.up();await settle();assert.equal((await read()).state.moves,0);
await page.mouse.move(source.x,source.y);await page.mouse.down();await page.mouse.move(right.x,right.y,{steps:10});await page.mouse.up();
assert.equal((await read()).state.moves,1);await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).feedback.impacts>0);
await page.screenshot({path:'artifacts/feel-impact.png'});await settle();assert.equal((await read()).feedback.flights,0);await click('#undo-btn');
// Cancelling a dragged bead must never commit the move or leave pointer capture stuck.
await page.mouse.move(source.x,source.y);await page.mouse.down();await page.mouse.move(right.x-60,right.y,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();await settle();assert.equal((await read()).state.moves,0);
// Undo during a flight cancels its pending collision sound as well as its visual.
await click('[data-source="rail-0"]');await click('[data-target="buffer-0"]');await click('#undo-btn');const events=(await read()).audio.events;
await page.waitForTimeout(1000);assert.equal((await read()).audio.events,events);assert.equal((await read()).state.moves,0);
// Reusing a buffer before its first flight settles must still conserve each bead.
await click('[data-source="rail-0"]');await click('[data-target="buffer-0"]');await click('[data-source="buffer-0"]');await click('[data-target="order-0"]');
await settle();assert.equal((await read()).state.moves,2);assert.deepEqual((await read()).state.orders[0],[0]);await click('#undo-btn');await click('#undo-btn');
await click('#audio-settings');await page.locator('#music-toggle').uncheck();
const slider=await page.locator('#volume-slider').boundingBox();await page.mouse.click(slider.x+slider.width*.4,slider.y+slider.height/2);
assert.ok((await read()).audio.volume>.3&&(await read()).audio.volume<.5);await click('#sound-preview');
await page.screenshot({path:'artifacts/feel-audio-settings.png'});await page.getByRole('button',{name:'回到工作台',exact:true}).click();
await page.reload();await click('#start-btn');assert.equal((await read()).audio.music,false);assert.ok((await read()).audio.volume<.5);
await click('#sound-btn');const muted=(await read()).audio.events;await click('[data-source="rail-0"]');await click('[data-target="order-0"]');await settle();assert.equal((await read()).audio.events,muted);
// Render the real audio synthesis offline: audible, bounded, distinct timbres, and quiet tails.
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
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(String(e)));
await mp.goto(base);await mp.locator('#start-btn').tap();await mp.locator('#accept-order').tap();
const cdp=await mobile.newCDPSession(mp),a=await mp.locator('[data-source="rail-0"]').boundingBox(),b=await mp.locator('[data-target="order-0"]').boundingBox();
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2,id:1}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});
assert.equal(await mp.evaluate(()=>JSON.parse(window.render_game_to_text()).feedback.dragging),true);await mp.screenshot({path:'artifacts/feel-touch.png',fullPage:true});
await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await mp.waitForTimeout(600);assert.equal(await mp.evaluate(()=>JSON.parse(window.render_game_to_text()).state.moves),0);
const first={x:a.x+a.width/2,y:a.y+a.height/2,id:1},second={x:a.x+a.width/2,y:a.y+a.height/2+42,id:2},end={x:b.x+b.width/2,y:b.y+b.height/2,id:1};
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first,second]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end,second]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[end]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
assert.equal(await mp.evaluate(()=>JSON.parse(window.render_game_to_text()).state.moves),1);await mp.locator('#undo-btn').tap();
await mp.locator('[data-source="rail-0"]').tap();await mp.locator('[data-target="order-0"]').tap();assert.equal(await mp.evaluate(()=>JSON.parse(window.render_game_to_text()).state.moves),1);
const reduced=await browser.newContext({reducedMotion:'reduce'}),rp=await reduced.newPage();rp.on('pageerror',e=>errors.push(String(e)));
await rp.goto(base);await rp.locator('#start-btn').click();await rp.locator('#accept-order').click();await rp.locator('[data-source="rail-0"]').click();await rp.locator('[data-target="order-0"]').click();assert.equal(await rp.evaluate(()=>JSON.parse(window.render_game_to_text()).feedback.flights),0);
await browser.close();assert.deepEqual(errors,[]);console.log('PASS: live bead contact, drag rejection, timed landing, cancellation, rapid input, mute and volume persistence, touch cancel, reduced motion; 24 audible distinct unclipped material profiles and launch sound.');
