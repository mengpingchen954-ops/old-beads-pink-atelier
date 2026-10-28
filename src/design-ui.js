import {COLORS} from './model.js';

import {TRAYS,loadWorkshop,buyTray} from './design-rules.js';
const $=s=>document.querySelector(s);
export function designBracelet(slots,art){return `<div class="design-bracelet" role="img" aria-label="你设计的听海手串：${slots.map(c=>COLORS[c].name).join('、')}"><i></i>${slots.map((c,i)=>{const a=-Math.PI/2+i*Math.PI/6;return `<img src="${art(COLORS[c].file)}" alt="" style="left:${50+Math.cos(a)*36}%;top:${50+Math.sin(a)*36}%">`;}).join('')}<span>听海的旧约</span></div>`;}
export function showroom(ctx){
 const {progress,art,openModal,closeModal,save,tone,toast}=ctx;
 const paint=()=>{
  const w=progress.workshop=loadWorkshop(progress.workshop);
  openModal(`<div class="eyebrow">我的工坊 · 亲手设计的作品</div><h2>把这一串光，留下来。</h2><div class="showcase-tray tray-${w.tray}">${w.design?designBracelet(w.design,art):'<div class="empty-display">✧<p>完成「听海的旧约」<br>这里将展示你的真实搭配</p></div>'}</div><p>${w.design?'“熟悉的三颗旧珠还在，海的颜色也在。谢谢你，让我又想起了她。” — 林女士':'收下特别委托，用自己的配色，修复一份旧日心意。'}</p><div class="tray-heading"><b>更换展示托盘</b><span>✦ ${progress.coins} 金币</span></div><div class="tray-shop">${TRAYS.map(t=>`<button data-tray="${t.id}" class="tray-choice ${w.tray===t.id?'chosen':''}" ${!w.owned.includes(t.id)&&progress.coins<t.price?'disabled':''}><i class="tray-${t.id}"></i><b>${t.name}</b><span>${w.tray===t.id?'使用中':w.owned.includes(t.id)?'已拥有 · 使用':`${t.price} 金币 · 购买`}</span></button>`).join('')}</div><p class="muted">首次完成特别委托奖励 240 金币；重新搭配可更新作品。金币只在游戏内使用。</p><div class="modal-actions"><button class="secondary" data-close>继续逛工坊</button><button class="primary" id="showcase-design">${w.design?'重新搭配':'收下特别委托'}</button></div>`,true);
  $('#showcase-design').onclick=()=>{closeModal();ctx.start();};
  document.querySelectorAll('[data-tray]').forEach(b=>b.onclick=()=>{
   const result=buyTray(progress.workshop,progress.coins,b.dataset.tray);
   if(!result){toast('金币还不够，完成委托后再来看看。');return;}
   Object.assign(progress,result);save();tone('coin');paint();
   document.querySelectorAll('.coin-balance,.design-coins').forEach(el=>el.textContent=`✦ ${progress.coins}`);
   const preview=document.querySelector('.home-custom');if(preview)preview.className=`cover home-custom tray-${progress.workshop.tray}`;
  });
 };paint();
}
