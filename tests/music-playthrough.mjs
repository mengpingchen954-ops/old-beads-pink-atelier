import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {MUSIC_TRACKS} from '../src/audio.js';
const base=process.env.GAME_URL||'http://127.0.0.1:5220/';
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{window.__musicPlayers=[];const NativeAudio=window.Audio;window.Audio=function(...args){const player=new NativeAudio(...args);window.__musicPlayers.push(player);return player;};});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  const read=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
  const click=selector=>mobile?page.locator(selector).tap():page.locator(selector).click();
  const waitPlaying=()=>page.waitForFunction(()=>{const p=__musicPlayers[0];return p&&!p.paused&&p.readyState>=3&&p.currentTime>0;});
  await page.goto(base);assert.equal(await page.evaluate(()=>__musicPlayers.length),0);
  await click('#sound-home');await waitPlaying();assert.equal((await read()).audio.track,'治愈少女');
  await page.locator('#music-volume-slider').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal((await read()).audio.musicVolume,.25);assert.ok(Math.abs(await page.evaluate(()=>__musicPlayers[0].volume)-.175)<.001);
  await page.locator('#music-toggle').uncheck();assert.equal((await read()).audio.playing,false);
  const pausedAt=(await read()).audio.time;await page.waitForTimeout(180);assert.equal((await read()).audio.time,pausedAt);
  await page.locator('#music-toggle').check();await waitPlaying();
  await page.screenshot({path:`artifacts/music-settings-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  await page.getByRole('button',{name:'回到工作台',exact:true}).click();
  const homeTime=(await read()).audio.time;await click('#start-btn');await click('#accept-order');await waitPlaying();assert.ok((await read()).audio.time>=homeTime);assert.equal(await page.evaluate(()=>__musicPlayers.length),1);
  await click('#sound-btn');assert.equal((await read()).audio.playing,false);await click('#sound-btn');await waitPlaying();
  // Visibility event follows the same path as switching a real tab to the background.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal((await read()).audio.playing,false);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await waitPlaying();
  await click('#go-home');await click('#design-home-entry');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);assert.equal((await read()).audio.playing,true);
  if(!mobile){
   for(let i=0;i<6;i++){
    const next=MUSIC_TRACKS[(i+1)%6].title;
    await page.evaluate(()=>{const p=__musicPlayers[0];p.currentTime=p.duration-.15;});
    await page.waitForFunction(title=>JSON.parse(render_game_to_text()).audio.track===title,next);await waitPlaying();
   }
   assert.equal(await page.evaluate(()=>__musicPlayers.length),1);
  }
  await page.reload();assert.equal((await read()).audio.musicVolume,.25);assert.equal((await read()).audio.playing,false);
  // Return from the designer to home after a fresh first gesture.
  await click('#sound-home');await waitPlaying();await page.locator('#music-toggle').uncheck();await page.reload();await click('#sound-home');assert.equal((await read()).audio.music,false);assert.equal((await read()).audio.playing,false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: real MP3 decode and playback, six-track wrap, one player across scenes, first gesture, mute, music toggle, independent volume, background pause/resume, saved settings and mobile.');
}finally{await browser.close();}
