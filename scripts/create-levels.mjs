import fs from 'node:fs';
import {commissions} from '../src/content.js';
import {createState,solve} from '../src/model.js';
function rng(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
const levels=commissions.map((c,index)=>{
 if(index===0)return {rails:[[0,1],[1,2],[2,0]],orders:[[0,1,2],[1,2,0]],capacity:3};
 let candidate;
 for(let attempt=0;attempt<500;attempt++){
  const r=rng(c.seed+attempt*37), orders=c.lengths.map(n=>Array.from({length:n},()=>Math.floor(r()*c.colors)));
  const bag=orders.flat();for(let j=bag.length-1;j>0;j--){const k=Math.floor(r()*(j+1));[bag[j],bag[k]]=[bag[k],bag[j]];}
  const rails=Array.from({length:c.railCount},()=>[]);bag.forEach((x,i)=>rails[i%c.railCount].push(x));
  const level={rails,orders,capacity:c.capacity};if(new Set(bag).size<c.colors)continue;const path=solve(createState(level),level,35000);
  if(!path||path.filter(a=>a.target.type==='buffer').length<Math.min(2,index))continue;
  candidate=level;break;
 }
 if(!candidate)throw Error(`No candidate ${index}`);
 return candidate;
});
fs.writeFileSync(new URL('../src/levels.js',import.meta.url),`// Deterministic fixtures; every level is solver-checked.\nexport const levels = ${JSON.stringify(levels,null,2)};\n`);
console.log(levels.map((l,i)=>({level:i+1,beads:l.orders.flat().length,buffer:solve(createState(l),l).filter(a=>a.target.type==='buffer').length})));
