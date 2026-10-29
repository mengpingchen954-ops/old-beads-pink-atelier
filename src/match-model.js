export const SLOTS=8;
// Related shades match; collection always records each bead's actual material.
export const COLOR_FAMILIES=[0,1,2,3,4,5,0,1,5,2];
export const FAMILY_NAMES=['粉红色系','青绿色系','金黄色系','月白色系','海蓝色系','紫灰色系'];
export const matchLevels=Array.from({length:12},(_,i)=>{
  const palette=Array.from({length:[3,3,4,4,5,5,6,6,7,8,9,10][i]},(_,c)=>c);
  const goals=Array.from({length:Math.min(3+Math.floor(i/3),5)},(_,j)=>({color:palette[(j+i)%palette.length],count:3+Math.floor(i/3)*3+i%3+(i>2?j%2*3:0)}));
  return {id:i,palette,goals,seed:197+7919*i};
});
export const cloneMatch=s=>({rings:s.rings.map(r=>[...r]),collected:[...s.collected],moves:s.moves,seed:s.seed});
export const matchWon=(s,l)=>l.goals.every(g=>s.collected[g.color]>=g.count);
export function matchingSlots(ring){
  const hits=new Set();
  for(let i=0;i<SLOTS;i++){
    const family=COLOR_FAMILIES[ring[i]],b=(i+1)%SLOTS,c=(i+2)%SLOTS;
    if(family!==undefined&&family===COLOR_FAMILIES[ring[b]]&&family===COLOR_FAMILIES[ring[c]])[i,b,c].forEach(j=>hits.add(j));
  }
  return [...hits].sort((a,b)=>a-b);
}
function random(s,n){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed%n;}
function refill(s,l,ring,index){
  const start=random(s,l.palette.length);
  for(let k=0;k<l.palette.length;k++){
    ring[index]=l.palette[(start+k)%l.palette.length];
    if(!matchingSlots(ring).includes(index))return;
  }
  // A full ring of one family needs an empty spacer while the other holes refill.
  ring[index]=null;
}
export function createMatchState(l){
  const s={rings:[Array(SLOTS).fill(null),Array(SLOTS).fill(null)],collected:Array(10).fill(0),moves:0,seed:l.seed};
  for(const ring of s.rings)for(let j=0;j<SLOTS;j++)refill(s,l,ring,j);
  return s;
}
export function matchColor(s,source){return source?.type==='palette'?source.index:source?.type==='ring'?s.rings[Math.floor(source.index/SLOTS)]?.[source.index%SLOTS]:undefined;}
export function canPlace(s,l,source,target){
  if(target?.type!=='slot'||!Number.isInteger(target.index)||target.index<0||target.index>=SLOTS*2)return false;
  const color=matchColor(s,source);
  return l.palette.includes(color)&&(source.type==='palette'||(source.type==='ring'&&Number.isInteger(source.index)&&source.index>=0&&source.index<SLOTS*2&&source.index!==target.index));
}
export function placeMatch(s,l,source,target){
  if(!canPlace(s,l,source,target)||matchWon(s,l))return null;
  const next=cloneMatch(s),r=Math.floor(target.index/SLOTS),slot=target.index%SLOTS,color=matchColor(s,source);
  if(source.type==='ring')next.rings[Math.floor(source.index/SLOTS)][source.index%SLOTS]=next.rings[r][slot];
  next.rings[r][slot]=color;next.moves++;
  const placed=next.rings.map(a=>[...a]),cleared=[];
  next.rings.forEach((ring,i)=>matchingSlots(ring).forEach(j=>{cleared.push({index:i*SLOTS+j,color:ring[j]});next.collected[ring[j]]++;}));
  for(const b of cleared)next.rings[Math.floor(b.index/SLOTS)][b.index%SLOTS]=null;
  for(const b of cleared)refill(next,l,next.rings[Math.floor(b.index/SLOTS)],b.index%SLOTS);
  // With three or more color families, every hole can be filled without free matches.
  for(const ring of next.rings)for(let j=0;j<SLOTS;j++)if(ring[j]===null)refill(next,l,ring,j);
  return {state:next,placed,cleared};
}
export function matchHint(s,l){
  const remaining=l.goals.filter(g=>s.collected[g.color]<g.count).map(g=>g.color);
  let best=null,bestScore=-Infinity;
  for(const color of l.palette)for(let index=0;index<SLOTS*2;index++){
    const source={type:'palette',index:color},target={type:'slot',index},result=placeMatch(s,l,source,target);
    if(!result)continue;
    const r=Math.floor(index/SLOTS),j=index%SLOTS,ring=result.placed[r];
    const score=result.cleared.reduce((v,b)=>v+(remaining.includes(b.color)?12:1),0)+
      (remaining.includes(color)?3:0)+[1,-1].reduce((v,d)=>v+(COLOR_FAMILIES[ring[(j+d+SLOTS)%SLOTS]]===COLOR_FAMILIES[color]?2:0),0);
    if(score>bestScore&&s.rings[r][j]!==color){bestScore=score;best={source,target};}
  }
  return best;
}
export function validMatchState(s,l){
  return !!s&&validMatchRings(s.rings,l)&&s.rings.every(r=>!matchingSlots(r).length)&&
    Array.isArray(s.collected)&&s.collected.length===10&&s.collected.every(n=>Number.isSafeInteger(n)&&n>=0)&&Number.isSafeInteger(s.moves)&&s.moves>=0&&Number.isInteger(s.seed)&&s.seed>=0&&s.seed<=4294967295;
}
export function validMatchRings(rings,l){return Array.isArray(rings)&&rings.length===2&&rings.every(r=>Array.isArray(r)&&r.length===SLOTS&&r.every(c=>l.palette.includes(c)));}
export function validMatchSession(s){return !!s&&s.mode==='match-v1'&&Number.isInteger(s.level)&&s.level>=0&&s.level<12&&validMatchState(s.state,matchLevels[s.level]);}
