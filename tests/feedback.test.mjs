import test from 'node:test';
import assert from 'node:assert/strict';
import {flightPoint,launchPoint,rebound} from '../src/feedback.js';
import {loadProgress} from '../src/model.js';
import {AtelierAudio} from '../src/audio.js';
test('flights land on the exact bead slot and never overshoot in x',()=>{
  const a={x:145,y:168},b={x:741,y:138};
  assert.deepEqual(flightPoint(-1,a,b),a);assert.deepEqual(flightPoint(2,a,b),b);
  for(let t=0;t<=1;t+=.02){const p=flightPoint(t,a,b);assert.ok(p.x>=a.x&&p.x<=b.x);assert.ok(Number.isFinite(p.y));}
});
test('collision response is finite, reverses direction and returns fully to rest',()=>{
  assert.equal(rebound(0),0);assert.ok(rebound(.04)>0);assert.ok(rebound(.12)<0);
  assert.ok(Math.abs(rebound(.6))<.005);assert.equal(rebound(.7),0);assert.equal(rebound(-1),0);
});
test('launches start at the emitter, arc above the direct path and land exactly in either direction',()=>{
 const from={x:500,y:623};
 for(const to of [{x:310,y:305},{x:690,y:305},{x:500,y:495}]){
  assert.deepEqual(launchPoint(-1,from,to),from);assert.deepEqual(launchPoint(2,from,to),to);
  for(let t=.01;t<1;t+=.02){const p=launchPoint(t,from,to),e=1-(1-t)**1.3;assert.ok(p.y<from.y+(to.y-from.y)*e);assert.ok(p.x>=Math.min(from.x,to.x)&&p.x<=Math.max(from.x,to.x));}
 }
});
test('sound settings migrate without losing commissions or accepting invalid volume',()=>{
  const read=p=>loadProgress({getItem:()=>JSON.stringify({version:1,completed:[0,2],...p})});
  assert.deepEqual(read({volume:9,music:false}).completed,[0,2]);assert.equal(read({volume:9}).volume,1);
  assert.equal(read({volume:-2}).volume,0);assert.equal(read({volume:'loud'}).volume,undefined);
  assert.equal(read({music:false}).music,false);
});
test('background completion callbacks cannot create or resume an audio context',()=>{
  const previous=globalThis.document;globalThis.document={hidden:true};
  try{const audio=new AtelierAudio({sound:true});audio.play('win');assert.equal(audio.ctx,undefined);assert.equal(audio.status().events,0);}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
