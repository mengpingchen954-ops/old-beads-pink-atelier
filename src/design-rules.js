import {COLORS} from './materials.js';
export const MATERIALS = COLORS.map((_,color)=>({color,count:color===0?1:color===3?7:4}));
export const TRAYS = [{id:'ivory',name:'珍珠白绒盘',price:0},{id:'azure',name:'海湾蓝绒盘',price:180},{id:'gold',name:'暖金丝绒盘',price:320}];
export const freshDesign = () => Array(12).fill(null);
export const remaining = (slots,color) => MATERIALS.find(m=>m.color===color)?.count-slots.filter(c=>c===color).length;
export function validDraft(slots){return Array.isArray(slots)&&slots.length===12&&slots.every(c=>c===null||MATERIALS.some(m=>m.color===c))&&MATERIALS.every(m=>remaining(slots,m.color)>=0);}
export function designChecks(slots){return [
 {label:'顶端串上三颗月光石（1、2、12号位）',ok:[0,1,11].every(i=>slots[i]===3)},
 {label:'十二颗珠子，串成完整一圈',ok:slots.every(c=>c!==null)},
 {label:'左右镜像对称（虚线两侧）',ok:[1,2,3,4,5].every(i=>slots[i]!==null&&slots[i]===slots[12-i])},
 {label:'至少四颗海色珠宝（蓝色或青色）',ok:slots.filter(c=>COLORS[c]?.sea).length>=4},
 {label:'底端用一颗粉晶，留下暖意',ok:slots[6]===0}
 ];}
export const designWon = slots => validDraft(slots)&&designChecks(slots).every(r=>r.ok);
export function placeBead(slots,index,color){
 if(!validDraft(slots)||!Number.isInteger(index)||index<0||index>11||!(color===null||MATERIALS.some(m=>m.color===color)))return null;
 const next=[...slots];next[index]=color;return validDraft(next)?next:null;
}
export function swapBeads(slots,from,to){
 if(!validDraft(slots)||![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<12)||from===to||slots[from]===null)return null;
 const next=[...slots];[next[from],next[to]]=[next[to],next[from]];return next;
}
export function loadWorkshop(value){
 const p=value??{},owned=['ivory',...TRAYS.filter(t=>t.price>0&&Array.isArray(p.owned)&&p.owned.includes(t.id)).map(t=>t.id)];
 return {draft:validDraft(p.draft)?[...p.draft]:freshDesign(),design:designWon(p.design??[])?[...p.design]:null,rewarded:p.rewarded===true,owned,tray:owned.includes(p.tray)?p.tray:'ivory'};
}
export function finishDesign(workshop,coins){
 if(!designWon(workshop.draft))return null;
 const reward=workshop.rewarded?0:240;
 return {workshop:{...workshop,design:[...workshop.draft],rewarded:true},coins:coins+reward,reward};
}
export function buyTray(workshop,coins,id){
 const tray=TRAYS.find(t=>t.id===id);if(!tray)return null;
 const price=workshop.owned.includes(id)?0:tray.price;if(coins<price)return null;
 return {workshop:{...workshop,owned:[...new Set([...workshop.owned,id])],tray:id},coins:coins-price};
}
