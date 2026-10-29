import test from 'node:test';
import assert from 'node:assert/strict';
import {SLOTS,matchLevels,createMatchState,cloneMatch,matchingSlots,placeMatch,matchWon,matchHint,validMatchSession,validMatchState} from '../src/match-model.js';
import {loadProgress} from '../src/model.js';
const source=color=>({type:'palette',index:color}),target=index=>({type:'slot',index});
test('circular matches include the seam, combine related colors and remove all members of a long run once',()=>{
 assert.deepEqual(matchingSlots([0,6,0,6,1,2,3,4]),[0,1,2,3]);
 assert.deepEqual(matchingSlots([0,6,1,2,3,4,1,0]),[0,1,7]);
 assert.deepEqual(matchingSlots([0,1,2,3,4,5,0,1]),[]);
 assert.deepEqual(matchingSlots(Array(8).fill(1)),Array.from({length:8},(_,i)=>i));
 assert.deepEqual(matchingSlots(Array(8).fill(null)),[]);
});
test('any palette bead replaces any occupied slot, replacement alone earns nothing and input remains immutable',()=>{
 const l=matchLevels[11],s=createMatchState(l),before=cloneMatch(s);
 for(const color of l.palette)for(let i=0;i<16;i++){const r=placeMatch(s,l,source(color),target(i));assert.ok(r);assert.equal(r.placed[Math.floor(i/8)][i%8],color);assert.equal(r.state.moves,1);assert.equal(r.state.collected.reduce((a,b)=>a+b),r.cleared.length);assert.ok(validMatchState(r.state,l));}
 assert.deepEqual(s,before);assert.equal(placeMatch(s,l,source(99),target(0)),null);assert.equal(placeMatch(s,l,source(0),target(16)),null);assert.equal(placeMatch(s,l,{type:'ring',index:-1},target(0)),null);
});
test('mixed shades credit actual material quantities and refill deterministically without unearned matches',()=>{
 const l=matchLevels[11],s=createMatchState(l);s.rings[0]=[0,6,1,2,3,4,5,1];
 const r=placeMatch(s,l,source(0),target(2));assert.deepEqual(r.cleared.map(b=>b.color),[0,6,0]);assert.equal(r.state.collected[0],2);assert.equal(r.state.collected[6],1);assert.ok(r.state.rings.every(a=>a.length===SLOTS&&a.every(Number.isInteger)&&!matchingSlots(a).length));
 assert.deepEqual(placeMatch(s,l,source(0),target(2)),r);assert.deepEqual(s.collected,Array(10).fill(0));
});
test('ring beads can swap arbitrary positions within and between bracelets',()=>{
 const l=matchLevels[11],s=createMatchState(l);
 for(const index of [3,8,15]){const r=placeMatch(s,l,{type:'ring',index:0},target(index));assert.equal(r.placed[0][0],s.rings[Math.floor(index/8)][index%8]);assert.equal(r.placed[Math.floor(index/8)][index%8],s.rings[0][0]);}
 assert.equal(placeMatch(s,l,{type:'ring',index:0},target(0)),null);
});
test('every level has distinct valid goals and can be completed through actual placements, clears and refills',()=>{
 const signatures=new Set();
 for(const l of matchLevels){let s=createMatchState(l);assert.ok(validMatchState(s,l));assert.deepEqual(s,createMatchState(l));signatures.add(JSON.stringify(l.goals));
  for(const goal of l.goals){let guard=0;while(s.collected[goal.color]<goal.count&&!matchWon(s,l)){assert.ok(++guard<80,'finite goal '+l.id);for(let i=0;i<3&&!matchWon(s,l);i++){const r=placeMatch(s,l,source(goal.color),target(i));assert.ok(r);s=r.state;assert.ok(validMatchState(s,l));}}}
  assert.ok(matchWon(s,l));assert.equal(placeMatch(s,l,source(0),target(0)),null);
 }
 assert.equal(signatures.size,12);
});
test('hints suggest a legal useful placement; save validation keeps new and old progression independent',()=>{
 const l=matchLevels[2],state=createMatchState(l),hint=matchHint(state,l);assert.ok(placeMatch(state,l,hint.source,hint.target));
 const matchSession={mode:'match-v1',level:2,state,history:[]};assert.ok(validMatchSession(matchSession));
 const original={version:1,completed:[0,1],coins:270,construction:{built:1},musicTrack:4,matchSession,session:null};
 const loaded=loadProgress({getItem:()=>JSON.stringify(original)});assert.deepEqual(loaded.matchSession,matchSession);assert.deepEqual(loaded.completed,[0,1]);assert.equal(loaded.construction.built,1);assert.equal(loaded.musicTrack,4);
 for(const bad of [{...state,rings:[[99],[]]},{...state,collected:[-1]},{...state,seed:NaN}]){assert.equal(validMatchSession({...matchSession,state:bad}),false);assert.equal(loadProgress({getItem:()=>JSON.stringify({...original,matchSession:{...matchSession,state:bad}})}).matchSession,null);}
});
