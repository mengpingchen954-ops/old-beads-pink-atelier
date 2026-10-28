import test from 'node:test';
import assert from 'node:assert/strict';
import {MATERIALS,freshDesign,validDraft,placeBead,swapBeads,remaining,designWon,loadWorkshop,finishDesign,buyTray} from '../src/design-rules.js';
import {loadProgress} from '../src/model.js';
const example=[3,3,4,7,5,4,0,4,5,7,4,3];
test('empty strands allow every site; finite materials cannot be duplicated; replacement returns stock',()=>{
 const initial=freshDesign();assert.deepEqual(initial,Array(12).fill(null));assert.ok(placeBead(initial,0,4));assert.ok(placeBead(initial,11,3));assert.equal(placeBead(initial,-1,4),null);assert.equal(placeBead(initial,2,99),null);
 let slots=initial;for(const i of [2,3,4,5])slots=placeBead(slots,i,4);
 assert.equal(placeBead(slots,6,4),null);slots=placeBead(slots,2,7);assert.ok(placeBead(slots,6,4));assert.equal(initial[2],null);assert.ok(validDraft(slots));
});
test('dragging swaps or moves existing beads without changing stock, including former legacy sites',()=>{
 const s=placeBead(freshDesign(),2,20),t=placeBead(s,3,23),swapped=swapBeads(t,2,3);
 assert.equal(swapped[2],23);assert.equal(swapped[3],20);assert.equal(t[2],20);
 for(const {color} of MATERIALS)assert.equal(remaining(swapped,color),remaining(t,color));
 const moved=swapBeads(swapped,2,4);assert.equal(moved[2],null);assert.equal(moved[4],23);
 for(const [a,b] of [[0,2],[4,4],[6,7],[-1,4],[4,12]])assert.equal(swapBeads(moved,a,b),null);
 assert.equal(remaining(freshDesign(),3),7);assert.equal(swapBeads(moved,4,0)[0],23);assert.equal(swapBeads(moved,4,11)[11],23);assert.ok(placeBead(freshDesign(),2,3));
});
test('expanded sea jewelry and shape charms can make a valid persisted commission',()=>{
 const slots=[3,3,10,19,23,22,0,22,23,19,10,3];assert.ok(designWon(slots));
 assert.deepEqual(loadWorkshop({draft:slots,design:slots}).design,slots);
 assert.equal(MATERIALS.length,24);
});
test('commission admits many distinct complete designs and rejects incomplete, asymmetric or wrong focal choices',()=>{
 assert.ok(designWon(example));assert.equal(designWon(freshDesign()),false);assert.equal(designWon([...example.slice(0,6),7,...example.slice(7)]),false);
 const wrong=[...example];[wrong[2],wrong[3]]=[wrong[3],wrong[2]];assert.equal(designWon(wrong),false);
 let count=0;for(const a of [4,7,5])for(const b of [4,7,5])for(const c of [4,7,5])for(const d of [4,7,5])if(designWon([3,3,a,b,c,d,0,d,c,b,a,3]))count++;
 assert.ok(count>10,`only ${count} solutions`);
});
test('first delivery awards coins exactly once; alternate design replaces actual saved creation',()=>{
 const w=loadWorkshop({draft:example});const result=finishDesign(w,0);assert.equal(result.coins,240);assert.equal(result.reward,240);assert.deepEqual(result.workshop.design,example);
 const restored=loadWorkshop(JSON.parse(JSON.stringify(result.workshop)));restored.draft=[3,3,7,4,5,4,0,4,5,4,7,3];
 const replay=finishDesign(restored,240);assert.equal(replay.coins,240);assert.equal(replay.reward,0);assert.notDeepEqual(replay.workshop.design,example);
 assert.equal(finishDesign(loadWorkshop(),50),null);
});
test('tray purchases require balance, subtract once, and persist with old commissions and session',()=>{
 const w=loadWorkshop({draft:example});assert.equal(buyTray(w,179,'azure'),null);assert.equal(buyTray(w,500,'unknown'),null);
 const bought=buyTray(w,240,'azure');assert.equal(bought.coins,60);assert.equal(bought.workshop.tray,'azure');assert.equal(buyTray(bought.workshop,60,'azure').coins,60);
 const saved=loadProgress({getItem:()=>JSON.stringify({version:1,completed:[0,2],coins:bought.coins,workshop:bought.workshop})});
 assert.deepEqual(saved.completed,[0,2]);assert.equal(saved.coins,60);assert.equal(saved.workshop.tray,'azure');assert.deepEqual(saved.workshop.draft,example);
});
test('corrupt new saves fall back safely without clearing existing progression',()=>{
 const w=loadWorkshop({draft:Array(12).fill(99),design:Array(12).fill(3),owned:['bad'],tray:'gold'});
 assert.deepEqual(w.draft,freshDesign());assert.equal(w.design,null);assert.deepEqual(w.owned,['ivory']);assert.equal(w.tray,'ivory');
 assert.equal(loadWorkshop({design:null}).design,null);assert.equal(validDraft(Array(12).fill(4)),false);
});

test('empty start and reset preserve existing seven-moonstone works and earned progress',()=>{
 const old=[3,3,3,3,4,4,0,4,4,3,3,3];assert.ok(designWon(old));
 const w=loadWorkshop({draft:old,design:old,rewarded:true,owned:['ivory','azure'],tray:'azure'});
 assert.deepEqual(w.design,old);assert.deepEqual(w.draft,old);assert.equal(w.rewarded,true);
 w.draft=freshDesign();const restored=loadWorkshop(w);assert.deepEqual(restored.draft,Array(12).fill(null));assert.deepEqual(restored.design,old);assert.equal(restored.tray,'azure');
});
