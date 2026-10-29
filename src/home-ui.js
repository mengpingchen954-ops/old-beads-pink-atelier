import {CONSTRUCTION_AREAS,CONSTRUCTION_TASKS,constructionState,repairTask,unlockedAreas} from './construction.js';
import {worldSVG,HOTSPOTS} from './world.js';
import {designBracelet} from './design-ui.js';
import {art} from './art.js';
let selectedArea=null;
const navIcon={home:'⌂',map:'♧',works:'♧',design:'◌',decor:'✿'};
export function renderHome(ctx){
 const {app,progress,base,openModal,closeModal,save,tone,toast,startOrder,designer,gallery,showcase,help,sound}=ctx;
 const $=s=>document.querySelector(s),build=constructionState(progress),next=CONSTRUCTION_TASKS[build.repaired];
 if(!selectedArea||!unlockedAreas(progress).includes(selectedArea))selectedArea=next?.area??'garden';
 const area=CONSTRUCTION_AREAS.find(a=>a.id===selectedArea);
 const current=next?.area===selectedArea;
 app.innerHTML=`<main class="village-home" data-scene="${selectedArea}"><header class="village-top"><a class="wordmark" href="#"><b>旧珠新约</b><small>一珠一心意 · 粉瓣小店</small></a><div class="village-wallet"><span>✦ <b class="coin-balance">${progress.coins}</b><small>金币</small></span><span>★ <b class="star-balance">${build.available}</b><small>建造星</small></span><button id="sound-home" class="icon-button" aria-label="声音设置">♫</button></div></header><div class="area-switcher" aria-label="选择场景">${CONSTRUCTION_AREAS.map(a=>`<button data-area="${a.id}" aria-pressed="${a.id===selectedArea}" ${unlockedAreas(progress).includes(a.id)?'':'disabled'}>${a.name}<small>${unlockedAreas(progress).includes(a.id)?`${Math.max(0,Math.min(4,build.repaired-a.unlock))}/4`:'修复前一区域后开放'}</small></button>`).join('')}</div><section class="village-stage"><div class="world-frame">${worldSVG(selectedArea,build.repaired)}${area.tasks.map((name,i)=>{const id=area.unlock+i,[x,y]=HOTSPOTS[selectedArea][i],done=id<build.repaired;return done?'':`<button class="build-hotspot ${id===build.repaired?'current':''}" data-repair="${id}" style="left:${x/12}%;top:${y/8}%" aria-label="建设：${name}" ${id===build.repaired?'':'disabled'}><span>${id===build.repaired?'★':'⌁'}</span><small>${name}</small></button>`}).join('')}</div><aside class="task-note"><span class="eyebrow">${build.repaired===12?'故事仍在继续':'小店修复记'}</span><h1>${next?.name??'焕然一新的家'}</h1><p>${next?build.available?'建造星准备好了，让这个角落重新发光。':'完成一关手串三消，带回一颗建造星。':'十二个角落，十二份心意。你的珠饰小店已经重新开门。'}</p><button class="secondary" id="build-home" ${next?'':'disabled'}>${next?'查看修复 · ★ 1':'全部修复完成 ✓'}</button><div class="stitch-progress"><span style="width:${build.repaired/12*100}%"></span></div><small>小店焕新 ${build.repaired} / 12</small></aside><button class="village-play primary" id="start-btn"><span>${progress.matchSession?'继续收集':progress.completed.length===12?'再玩一关':'开始闯关'}<small>第 ${ctx.level+1} 关 · ${ctx.title}</small></span><b>→</b></button><img class="village-keeper" src="${base}art/pink/keeper.webp" alt="粉色围裙的店主"></section><footer class="village-bottom"><nav><button class="chosen" id="village-home">${navIcon.home}<small>小店</small></button><button id="map-home">${navIcon.map}<small>委托地图</small></button><button id="collection-home">${navIcon.works}<small>作品册</small></button><button id="design-home-entry">${navIcon.design}<small>亲手搭配</small></button><button id="showcase-home">${navIcon.decor}<small>橱窗装饰</small></button></nav><button class="text-button" id="how-home">玩法小笺 ?</button></footer></main>`;
 $('#start-btn').onclick=startOrder;$('#collection-home').onclick=gallery;$('#design-home-entry').onclick=designer;$('#showcase-home').onclick=showcase;$('#how-home').onclick=help;$('#sound-home').onclick=sound;$('#village-home').onclick=()=>{selectedArea=next?.area??'garden';renderHome(ctx);};
 if(progress.workshop?.design){
  $('.village-stage').insertAdjacentHTML('beforeend',`<button class="home-custom village-custom tray-${progress.workshop.tray}" aria-label="查看我的真实手串">${designBracelet(progress.workshop.design,art)}</button>`);
  $('.village-custom').onclick=showcase;
 }
 document.querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>{selectedArea=b.dataset.area;renderHome(ctx);});
 const preview=id=>{
  const task=CONSTRUCTION_TASKS[id],now=constructionState(progress);
  if(!task||id!==now.repaired)return;
  const enough=now.available>0;
  openModal(`<div class="eyebrow">修复计划 · ${CONSTRUCTION_AREAS[task.areaIndex].name}</div><h2>${task.name}</h2><div class="build-preview">${worldSVG(task.area,now.repaired+1)}<span>修复后</span></div><p>${enough?'用一颗建造星，把这处角落修好。修复结果会一直保留。':'还需要一颗建造星。首次完成新的委托即可获得，重玩不会重复发星。'}</p><div class="build-cost">★ 需要 1 <span>持有 ${now.available}</span></div><div class="modal-actions"><button class="secondary" data-close>稍后再修</button><button class="primary" id="confirm-build">${enough?'开始修复 · ★ 1':'去赚建造星 →'}</button></div>`,true);
  $('#confirm-build').onclick=()=>{
   if(!enough){closeModal();startOrder();return;}
   const result=repairTask(progress,id);if(!result)return;
   Object.assign(progress,result.progress);save();tone('win');closeModal();selectedArea=task.area;renderHome(ctx);
   $('.world-frame').classList.add('just-built');toast(`✓ ${task.name}，修复完成`);
   if((id+1)%4===0&&id<11){const nextArea=CONSTRUCTION_AREAS[task.areaIndex+1];openModal(`<div class="unlock-ribbon">✿ 新区域开放 ✿</div><h2>${nextArea.name}</h2><div class="build-preview">${worldSVG(nextArea.id,id+1)}</div><p>${CONSTRUCTION_AREAS[task.areaIndex].name}已经修好，下一份故事正等着你。</p><button class="primary" id="visit-area">去${nextArea.name}看看 →</button>`,true);$('#visit-area').onclick=()=>{selectedArea=nextArea.id;closeModal();renderHome(ctx);};}
  };
 };
 $('#build-home').onclick=()=>preview(build.repaired);document.querySelectorAll('[data-repair]').forEach(b=>b.onclick=()=>preview(Number(b.dataset.repair)));
 $('#map-home').onclick=()=>renderMap(ctx);
}
export function renderMap(ctx){
 const {progress,openModal,closeModal}=ctx,build=constructionState(progress);
 openModal(`<div class="eyebrow">来客的小路 · 12 份珠饰委托</div><h2>沿着心意，慢慢向前。</h2><div class="journey-map">${CONSTRUCTION_AREAS.map((a,j)=>`<section class="journey-chapter"><h3>${a.name} <small>修复 ${Math.max(0,Math.min(4,build.repaired-a.unlock))}/4</small></h3><div class="journey-path">${Array.from({length:4},(_,k)=>{const n=j*4+k,done=progress.completed.includes(n),unlocked=n===0||progress.completed.includes(n-1)||done;return `<button class="level-node ${done?'done':unlocked?'next':'locked'}" data-map-level="${n}" ${unlocked?'':'disabled'}><b>${done?'✓':n+1}</b><span>第 ${n+1} 关</span><small>${done?'已交付':unlocked?'收下委托':'待解锁'}</small></button>`}).join('')}</div></section>`).join('')}</div><p class="muted">首次完成一份委托 = 一枚建造星。建造星在小店内修复使用。</p>`,true);
 document.querySelectorAll('[data-map-level]').forEach(b=>b.onclick=()=>{closeModal();ctx.startLevel(Number(b.dataset.mapLevel));});
}
