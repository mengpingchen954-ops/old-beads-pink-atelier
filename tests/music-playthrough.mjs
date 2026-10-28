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
  assert.equal(await page.locator('[data-music-track]').count(),6);
  for(const i of [2,5,1,4,3,0]){
   await click(`[data-music-track="${i}"]`);await waitPlaying();
   assert.equal((await read()).audio.track,MUSIC_TRACKS[i].title);
   assert.match(await page.locator('#music-current').innerText(),new RegExp(MUSIC_TRACKS[i].title));
   assert.equal(await page.locator('[data-music-track][aria-pressed="true"]').count(),1);
   assert.equal(await page.locator(`[data-music-track="${i}"]`).getAttribute('aria-pressed'),'true');
   assert.ok((await page.evaluate(()=>__musicPlayers[0].src)).endsWith(`/audio/${MUSIC_TRACKS[i].file}`));
  }
  if(!mobile){
   await page.evaluate(()=>{const p=__musicPlayers[0];p.currentTime=p.duration-.15;});
   await page.waitForFunction(()=>document.querySelector('[data-music-track="1"]').getAttribute('aria-pressed')==='true');await waitPlaying();
   assert.match(await page.locator('#music-current').innerText(),/宁静的微光/);
   await page.locator('[data-music-track="0"]').focus();await page.keyboard.press('Enter');await waitPlaying();
  }
  const sameTrackTime=(await read()).audio.time;await click('[data-music-track="0"]');assert.ok((await read()).audio.time>=sameTrackTime);
  assert.equal(await page.evaluate(()=>__musicPlayers.length),1);
  await page.locator('#music-volume-slider').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal((await read()).audio.musicVolume,.25);await page.waitForFunction(()=>Math.abs(JSON.parse(render_game_to_text()).audio.musicLevel-.175)<.001);
  await page.locator('#music-toggle').uncheck();assert.equal((await read()).audio.playing,false);
  const pausedAt=(await read()).audio.time;await page.waitForTimeout(180);assert.equal((await read()).audio.time,pausedAt);
  await click('[data-music-track="4"]');assert.equal((await read()).audio.playing,false);assert.equal((await read()).audio.track,MUSIC_TRACKS[4].title);
  await page.locator('#music-toggle').check();await waitPlaying();await click('[data-music-track="0"]');await waitPlaying();
  await page.screenshot({path:`artifacts/music-settings-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  await page.getByRole('button',{name:'回到工作台',exact:true}).click();
  const homeTime=(await read()).audio.time;await click('#start-btn');await click('#accept-order');await waitPlaying();assert.ok((await read()).audio.time>=homeTime);assert.equal(await page.evaluate(()=>__musicPlayers.length),1);
  const beforeButtonTrack=(await read()).audio.track;
  await click('#sound-btn');await page.waitForTimeout(480);
  assert.equal((await read()).audio.track,MUSIC_TRACKS[(MUSIC_TRACKS.findIndex(t=>t.title===beforeButtonTrack)+1)%MUSIC_TRACKS.length].title);
  assert.equal((await read()).modal,false);
  const beforeDoubleTrack=(await read()).audio.track;
  if(mobile){await click('#sound-btn');await click('#sound-btn');}else await page.locator('#sound-btn').dblclick();
  await page.locator('#volume-slider').waitFor();await page.waitForTimeout(480);
  assert.equal((await read()).audio.track,beforeDoubleTrack);
  await page.locator('#volume-slider').fill('60');assert.equal((await read()).audio.volume,.6);
  await page.screenshot({path:`artifacts/speaker-volume-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  await page.getByRole('button',{name:'回到工作台',exact:true}).click();
  // A slower double gesture still opens settings without changing the song.
  const soundBox=await page.locator('#sound-btn').boundingBox(),soundX=soundBox.x+soundBox.width/2,soundY=soundBox.y+soundBox.height/2;
  const soundTap=()=>mobile?page.touchscreen.tap(soundX,soundY):page.mouse.click(soundX,soundY);
  await soundTap();await page.waitForTimeout(300);await soundTap();
  await page.locator('#volume-slider').waitFor();await page.waitForTimeout(480);assert.equal((await read()).audio.track,beforeDoubleTrack);
  await page.locator('#sound-toggle').uncheck();assert.equal((await read()).audio.playing,false);
  await page.locator('#sound-toggle').check();await waitPlaying();
  await page.getByRole('button',{name:'回到工作台',exact:true}).click();
  // Opening another dialog cancels a pending skip rather than changing music behind it.
  await click('#sound-btn');await click('#help-btn');await page.waitForTimeout(480);assert.equal((await read()).audio.track,beforeDoubleTrack);
  await page.keyboard.press('Escape');
  if(!mobile){
   await page.locator('#sound-btn').focus();await page.keyboard.press('Enter');await page.waitForTimeout(480);
   const next=MUSIC_TRACKS[(MUSIC_TRACKS.findIndex(t=>t.title===beforeDoubleTrack)+1)%MUSIC_TRACKS.length].title;assert.equal((await read()).audio.track,next);
  }
  const beforeNavigationTrack=(await read()).audio.track;await click('#sound-btn');await click('#go-home');await page.waitForTimeout(480);assert.equal((await read()).audio.track,beforeNavigationTrack);
  // Visibility event follows the same path as switching a real tab to the background.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal((await read()).audio.playing,false);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await waitPlaying();
  await click('#design-home-entry');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).design);assert.equal((await read()).audio.playing,true);
  if(!mobile){
   const loopTrack=(await read()).audio.track,loopStart=MUSIC_TRACKS.findIndex(t=>t.title===loopTrack);
   for(let i=0;i<6;i++){
    const next=MUSIC_TRACKS[(loopStart+i+1)%6].title;
    await page.evaluate(()=>{const p=__musicPlayers[0];p.currentTime=p.duration-.15;});
    await page.waitForFunction(title=>JSON.parse(render_game_to_text()).audio.track===title,next);await waitPlaying();
   }
   assert.equal(await page.evaluate(()=>__musicPlayers.length),1);
  }
  await click('#design-home');await click('#sound-home');
  await click('[data-music-track="3"]');await waitPlaying();
  await page.reload();assert.equal((await read()).audio.track,MUSIC_TRACKS[3].title);assert.equal((await read()).audio.musicVolume,.25);assert.equal((await read()).audio.volume,.6);assert.equal((await read()).audio.playing,false);
  // Return from the designer to home after a fresh first gesture.
  await click('#sound-home');await waitPlaying();await page.locator('#music-toggle').uncheck();await page.reload();await click('#sound-home');assert.equal((await read()).audio.music,false);assert.equal((await read()).audio.playing,false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: six manual track selections, speaker single-click next and double-click volume settings, master mute, real MP3 decode and playback, six-track wrap, one player across scenes, first gesture, music toggle, independent volume, background pause/resume, saved settings and mobile.');
}finally{await browser.close();}
