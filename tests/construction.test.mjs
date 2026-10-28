import test from 'node:test';
import assert from 'node:assert/strict';
import {constructionState,repairTask,unlockedAreas} from '../src/construction.js';
import {loadProgress} from '../src/model.js';
test('each repair consumes one earned star and cannot be repeated, skipped or overspent',()=>{
 let p={completed:[],coins:400};assert.equal(repairTask(p,0),null);
 p.completed.push(0);assert.equal(constructionState(p).available,1);
 assert.equal(repairTask(p,1),null);const result=repairTask(p,0);p=result.progress;
 assert.equal(p.coins,400);assert.equal(constructionState(p).available,0);
 assert.equal(repairTask(p,0),null);assert.equal(repairTask(p,1),null);
 for(let i=1;i<12;i++){p.completed.push(i);p=repairTask(p,i).progress;assert.equal(constructionState(p).repaired,i+1);assert.equal(constructionState(p).available,0);assert.equal(unlockedAreas(p).length,i<3?1:i<7?2:3);}
 assert.equal(repairTask(p,12),null);
});
test('pink saves preserve unspent stars and repairs while leaving the original storage key alone',()=>{
 const original=JSON.stringify({version:1,completed:[0,1,2,3],coins:999});
 const values=new Map([['old-beads-v1',original]]),reads=[];
 const storage={getItem:k=>{reads.push(k);return values.get(k)??null;}};
 assert.deepEqual(loadProgress(storage).completed,[]);assert.deepEqual(reads,['old-beads-pink-v1']);
 values.set('old-beads-pink-v1',JSON.stringify({version:1,completed:[0,1,2,3,4],coins:375,construction:{built:4}}));
 const restored=loadProgress(storage);assert.equal(constructionState(restored).available,1);assert.equal(constructionState(restored).repaired,4);assert.deepEqual(unlockedAreas(restored),['shop','studio']);assert.equal(values.get('old-beads-v1'),original);
});
