import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.GAME_URL||'http://127.0.0.1:5220/';
const browser=await chromium.launch({headless:true}),errors=[];
fs.mkdirSync('artifacts',{recursive:true});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1000}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  const read=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
  const click=s=>mobile?page.locator(s).tap():page.locator(s).click();
  const audible=async(s,delta=1)=>{const before=(await read()).audio.events;await click(s);assert.equal((await read()).audio.events-before,delta,`${mobile?'touch':'mouse'}: ${s} must sound exactly ${delta} time(s)`);};
  await page.goto(base);assert.equal((await read()).audio.events,0);
  await audible('#map-home small');assert.equal((await read()).audio.state,'running');
  await audible('#modal .modal-close');await audible('#collection-home');await audible('#modal .modal-close');
  await audible('[data-area="shop"]');await audible('.build-hotspot.current span');await audible('[data-close].secondary');
  await audible('#build-home');await audible('#confirm-build');await page.locator('#accept-order').waitFor();await audible('#accept-order');
  await audible('#help-btn');await audible('#modal .modal-close');await audible('#hint-btn');
  // The bead retains its own sound instead of layering a menu click over it.
  await audible('[data-source="palette-0"]');await click('[data-target="slot-0"]');
  await page.waitForFunction(()=>{const f=JSON.parse(render_game_to_text()).feedback;return !f.flights&&!f.impacts;});await audible('#undo-btn');
  await audible('#audio-settings');
  await page.locator('#music-toggle').uncheck();
  const beforeLabel=(await read()).audio.events;await click('label:has(#music-toggle) span');assert.equal((await read()).audio.events,beforeLabel+1,'label forwarding must not double the switch sound');
  await page.locator('#music-toggle').uncheck();
  if(!mobile){const before=(await read()).audio.events;await page.locator('#volume-slider').focus();await page.keyboard.press('ArrowLeft');assert.equal((await read()).audio.events,before+1);}
  await page.locator('#sound-toggle').uncheck();const muted=(await read()).audio.events;
  await click('[data-music-track="2"]');await click('#modal .modal-close');await click('#help-btn');await click('#modal .modal-close');assert.equal((await read()).audio.events,muted);
  await page.reload();await click('#start-btn');assert.equal((await read()).audio.enabled,false);assert.equal((await read()).audio.events,0);
  await click('#audio-settings');await audible('#sound-toggle');assert.equal((await read()).audio.enabled,true);
  await page.locator('#volume-slider').fill('45');assert.equal((await read()).audio.volume,.45);
  await page.screenshot({path:`artifacts/ui-sounds-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  await audible('#modal .modal-close');await audible('#go-home');await audible('#design-home-entry');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);
  await audible('[data-filter="gem"]');await audible('[data-filter="all"]');await audible('#design-move');await audible('[data-material="4"]');
  if(mobile)await audible('.design-letter summary');
  // The existing material preview, failed delivery and reward effects are not doubled.
  await audible('#design-submit');await audible('#design-reset');await audible('#design-confirm-reset');
  if(!mobile){const before=(await read()).audio.events;await page.locator('[data-filter="charm"]').focus();await page.keyboard.press('Enter');assert.equal((await read()).audio.events,before+1);}
  const beforeBackground=(await read()).audio.events;
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));document.querySelector('[data-filter="all"]').click();});assert.equal((await read()).audio.events,beforeBackground);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  await audible('#design-showcase');await audible('[data-tray="ivory"]');await audible('#modal .modal-close');
  await audible('#design-home');
  const beforeDisabled=(await read()).audio.events;await page.locator('[data-area="studio"]').dispatchEvent('click');assert.equal((await read()).audio.events,beforeDisabled);
  if(!mobile){
   const code=fs.readFileSync('src/audio.js','utf8');
   const rendered=await page.evaluate(async source=>{
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),{synthesize}=await import(url);URL.revokeObjectURL(url);
    const kinds=['ui-tap','ui-confirm','ui-back','ui-toggle'],profiles=[];
    for(const kind of kinds){
     const ctx=new OfflineAudioContext(1,44100,44100);synthesize(ctx,ctx.destination,kind,{},.01);const b=await ctx.startRendering(),data=b.getChannelData(0);
     let peak=0,energy=0,tail=0,signature=0;for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));energy+=data[i]**2;if(i>15435)tail+=data[i]**2;signature+=data[i]*Math.cos(i*.09);}
     profiles.push({kind,peak,rms:Math.sqrt(energy/data.length),tail,signature});
    }
    const ctx=new OfflineAudioContext(1,44100*3,44100);kinds.forEach((kind,i)=>synthesize(ctx,ctx.destination,kind,{},.1+i*.65));const b=await ctx.startRendering();
    return {profiles,samples:Array.from(b.getChannelData(0))};
   },code);
   for(const p of rendered.profiles){assert.ok(p.peak>.02&&p.peak<.3);assert.ok(p.rms>.001);assert.ok(p.tail<.00001);}
   assert.equal(new Set(rendered.profiles.map(p=>p.signature.toFixed(5))).size,4);
   const wav=Buffer.alloc(44+rendered.samples.length*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);rendered.samples.forEach((s,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,s))*32767),44+i*2));
   fs.writeFileSync('artifacts/ui-sound-demo.wav',wav);fs.writeFileSync('artifacts/ui-sound-profiles.json',JSON.stringify(rendered.profiles,null,2));
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: cute UI sounds across home, dialogs, tools, designer, toggles and labels; one sound per mouse/touch/keyboard action, existing foley priority, mute persistence, volume, disabled/background silence; four short audible unclipped distinct sound profiles.');
}finally{await browser.close();}
