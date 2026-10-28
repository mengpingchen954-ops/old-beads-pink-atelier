import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,clone,move,won,solve,actions,validLevel,loadProgress} from '../src/model.js';
import {levels} from '../src/levels.js';
test('all twelve commissions have matching supply and demand and complete solutions',()=>{
 assert.equal(levels.length,12);
 for(const level of levels){assert.ok(validLevel(level));let state=createState(level);const path=solve(state,level);assert.ok(path);for(const a of path){const before=clone(state),next=move(state,level,a.source,a.target);assert.deepEqual(state,before);assert.ok(next);state=next;assert.equal([...state.rails.flat(),...state.orders.flat(),...state.buffer.filter(x=>x!==null)].length,level.orders.flat().length);}assert.ok(won(state,level));assert.equal(actions(state,level).length,0);}
});
test('bead palette expands with chapter difficulty',()=>{
 const expected=[3,3,3,4,4,5,5,6,7,8,9,10];
 assert.deepEqual(levels.map(level=>new Set(level.orders.flat()).size),expected);
 for(const [index,level] of levels.entries())assert.deepEqual([...new Set(level.orders.flat())].sort((a,b)=>a-b),Array.from({length:expected[index]},(_,color)=>color));
});
test('wrong colors and illegal storage moves preserve state; undo snapshot restores bead counts',()=>{
 const l=levels[0],s=createState(l),before=clone(s);assert.equal(move(s,l,{type:'rail',index:0},{type:'order',index:1}),null);assert.deepEqual(s,before);
 const buffered=move(s,l,{type:'rail',index:0},{type:'buffer',index:0});assert.equal(buffered.buffer[0],0);assert.equal(move(buffered,l,{type:'buffer',index:0},{type:'buffer',index:1}),null);assert.equal(move(buffered,l,{type:'rail',index:1},{type:'buffer',index:0}),null);
 const delivered=move(buffered,l,{type:'buffer',index:0},{type:'order',index:0});assert.equal(delivered.buffer[0],null);assert.deepEqual(s,before);
});
test('blocked states can be recognized, and a saved snapshot remains solvable',()=>{
 let found=false;
 for(const l of levels.slice(1)){const s=createState(l),queue=[s];let iterations=0;while(queue.length&&++iterations<10000){const t=queue.pop(),a=actions(t,l);if(!a.length&&!won(t,l)){assert.equal(solve(t,l,10000),null);assert.ok(solve(s,l));found=true;break;}queue.push(...a.map(x=>move(t,l,x.source,x.target)));}if(found)break;}
 assert.ok(found,'at least one real blocking situation should exist');
});
test('corrupt progress is ignored; completed indices are bounded and deduplicated',()=>{
 const storage=value=>({getItem:()=>value});assert.deepEqual(loadProgress(storage('broken')).completed,[]);assert.deepEqual(loadProgress(storage(JSON.stringify({version:1,completed:[0,0,-1,99,1],sound:false}))),{completed:[0,1],coins:0,sound:false,session:null});assert.equal(loadProgress({getItem:()=>{throw Error();}}).session,null);
});
test('coin balance is backward compatible and only accepts non-negative integers',()=>{
 const storage=value=>({getItem:()=>value});
 assert.equal(loadProgress(storage(JSON.stringify({version:1,completed:[],coins:275}))).coins,275);
 for(const coins of [-1,1.5,'275',null])assert.equal(loadProgress(storage(JSON.stringify({version:1,completed:[],coins}))).coins,0);
 assert.equal(loadProgress(storage(JSON.stringify({version:1,completed:[]}))).coins,0);
});
