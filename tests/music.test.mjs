import test from 'node:test';
import assert from 'node:assert/strict';
import {AtelierAudio,MUSIC_TRACKS} from '../src/audio.js';
import {statSync} from 'node:fs';

test('music is lazy, survives autoplay rejection, skips failed tracks and stops after a failed playlist',async()=>{
 const previous={document:globalThis.document,Audio:globalThis.Audio};
 globalThis.document={hidden:false};
 let blocked=true,created=0;
 globalThis.Audio=class{
  constructor(src){created++;this.src=src;this.paused=true;this.currentTime=0;}
  pause(){this.paused=true;}
  play(){if(blocked)return Promise.reject(new Error('gesture required'));this.paused=false;return Promise.resolve();}
 };
 try{
  const audio=new AtelierAudio({sound:true});audio.setActive(true);assert.equal(created,0);
  audio.unlock();await Promise.resolve();assert.equal(created,1);assert.equal(audio.status().playing,false);
  blocked=false;audio.unlock();assert.equal(audio.status().playing,true);
  audio.player.pause();audio.player.onerror();assert.equal(audio.track,1);assert.equal(audio.status().playing,true);
  audio.player.onended();assert.equal(audio.track,2);assert.equal(audio.failures,0);
  for(let i=0;i<MUSIC_TRACKS.length;i++){audio.player.pause();audio.player.onerror();}
  audio.apply();assert.equal(audio.status().playing,false);assert.equal(created,1);
  for(const track of MUSIC_TRACKS)assert.ok(statSync(new URL(`../public/audio/${track.file}`,import.meta.url)).size>100000);
 }finally{
  for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
 }
});
