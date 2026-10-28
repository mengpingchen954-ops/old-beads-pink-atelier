import {COLORS} from './materials.js';
import {W,H,designPos,launcherPos,designBeadSize} from './renderer.js';
import {MATERIALS,freshDesign,remaining,designChecks,designWon,placeBead,swapBeads,loadWorkshop,finishDesign} from './design-rules.js';
import {designBracelet,showroom} from './design-ui.js';
const $=s=>document.querySelector(s);

export async function mountDesigner(ctx){
 const {app,progress,art,save,tone,toast,openModal,closeModal}=ctx;
 progress.workshop=loadWorkshop(progress.workshop);
 let draft=freshDesign(),resumable=progress.workshop.draft.some(c=>c!==null)?[...progress.workshop.draft]:null;
 let selectedColor=4,selectedSlot=null,history=[],moveMode=false,movingFrom=null,pointer=null,filter='all',ignoreSlotClickUntil=0;
 const listeners=new AbortController();
 app.innerHTML=`<main class="design-shell"><header class="design-header"><button class="text-button" id="design-home">← 回工坊</button><a class="brand"><img src="${art('seal')}" alt=""><span class="brand-cn">旧珠新约</span></a><div><span class="design-coins">✦ ${progress.coins}</span><button class="secondary" id="design-showcase">我的橱窗</button></div></header>
 <section class="design-layout"><aside class="design-brief"><div class="eyebrow">特别委托 / 弹射与自由搭配</div><h1>听海的旧约</h1><p class="mobile-design-goal">左右对称 · 至少4颗海色 · 底端粉晶</p><details class="design-letter" open><summary>来信与委托要求 <span id="design-letter-progress"></span></summary><div class="design-client"><img src="${art('customer-lin')}" alt=""><div><b>林女士的来信</b><small>一份想留住的心意</small></div></div><blockquote>“这三颗月光石，是母亲留下的。请从空串开始，把它们串在顶端，再配一点海的颜色，左右对称，底下加一颗暖暖的粉晶。”</blockquote><div id="design-checks" class="design-checks" aria-label="委托要求"></div><p class="design-note">先弹射，再拖动调整。<br>拖到另一颗上可以交换位置。<br>蓝月光、蓝托帕石、蝶翼琉璃也属于海色。</p><span class="design-bounty">首次交付奖励 <b>✦ 240</b></span></details></aside>
 <section class="design-work"><div class="design-step"><b>① 选珠　② 弹射　③ 拖动换位</b><span id="design-count"></span></div><div id="board" class="board-wrap design-board"><div id="design-hit-layer" class="hit-layer" aria-label="弹射与串珠工作台"></div></div><div id="design-status" class="design-status" role="status">选一颗珠宝，点击蓝色发射座。落珠后可以直接拖动换位。</div>
 <section class="jewelry-library" aria-label="珠宝材料库"><div class="jewelry-library-head"><b>珠宝盒 <span>24 种</span></b><small>滑动查看更多</small></div><div class="jewelry-filters" aria-label="材料分类">${[['all','全部'],['crystal','水晶'],['natural','天然材质'],['gem','切面宝石'],['charm','造型配饰']].map(([id,name])=>`<button data-filter="${id}" aria-pressed="${id==='all'}">${name}</button>`).join('')}</div><div class="design-materials">${MATERIALS.map(m=>`<button data-material="${m.color}" aria-pressed="false"><img src="${art(COLORS[m.color].file)}" alt="" loading="eager"><b>${COLORS[m.color].name}</b><span data-stock="${m.color}"></span></button>`).join('')}</div></section>
 <footer class="design-actions"><div><button class="tool" id="design-resume" hidden>继续上次搭配</button><button class="tool" id="design-undo">↶ 撤销</button><button class="tool" id="design-move" aria-pressed="false">换位</button><button class="tool" data-material="remove" aria-pressed="false">取下</button><button class="tool" id="design-reset">重来</button><button class="tool" id="design-sound" aria-label="切换声音">声音</button></div><button class="primary" id="design-submit">欣赏并交付 ✦</button></footer></section></section></main>`;
 $('.design-letter').open=innerWidth>600;
 $('#design-home').onclick=ctx.home;$('#design-showcase').onclick=()=>{cancel();showroom(ctx);};$('#design-sound').onclick=()=>{ctx.toggleSound();$('#design-sound').setAttribute('aria-pressed',String(progress.sound));};
 const board=await ctx.ensureBoard();if(!ctx.active()){listeners.abort();return null;}
 // Ignore the synthetic tap after a drag while preserving new gestures and keyboard clicks.
 $('#design-hit-layer').addEventListener('click',e=>{if(e.detail>0&&performance.now()<ignoreSlotClickUntil&&e.target.closest('[data-slot]')){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 const status=message=>{$('#design-status').textContent=message;};
 const interactive=()=>ctx.active()&&!$('#modal')&&!document.hidden;
 const nextSlot=()=>draft.findIndex(c=>c===null);
 function refresh(){
  if(!ctx.active())return;const slots=draft,checks=designChecks(slots),aim=nextSlot();
  board.drawDesign({slots,selected:movingFrom??selectedSlot,color:moveMode?null:selectedColor,aim:aim<0?null:aim});
  $('#design-letter-progress').textContent=checks.filter(r=>r.ok).length+'/5';
  $('#design-count').textContent=`${slots.filter(c=>c!==null).length} / 12 颗`;
  $('#design-checks').innerHTML=checks.map(r=>`<div class="${r.ok?'met':''}"><span>${r.ok?'✓':'○'}</span>${r.label}</div>`).join('');
  document.querySelectorAll('.design-materials [data-material]').forEach(b=>{const color=Number(b.dataset.material),stock=remaining(slots,color);b.setAttribute('aria-pressed',String(!moveMode&&color===selectedColor));b.querySelector('[data-stock]').textContent=`余 ${stock}`;b.setAttribute('aria-label',`${COLORS[color].name}，余 ${stock} 颗`);b.hidden=filter!=='all'&&COLORS[color].family!==filter;});
  $('[data-material="remove"]').setAttribute('aria-pressed',String(!moveMode&&selectedColor===null));
  $('#design-move').setAttribute('aria-pressed',String(moveMode));$('#design-sound').setAttribute('aria-pressed',String(progress.sound));
  $('#design-resume').hidden=!resumable;$('#design-undo').disabled=!history.length;$('#design-submit').textContent=designWon(slots)?'欣赏并交付 ✦':'检查搭配并交付';
  const layer=$('#design-hit-layer'),focused=document.activeElement?.dataset.slot;
  slots.forEach((color,i)=>{
   const p=designPos(i),b=layer.querySelector(`[data-slot="${i}"]`)??document.createElement('button'),size=designBeadSize();b.className='board-hit';b.dataset.slot=i;
   b.style.cssText=`left:${p.x/W*100}%;top:${p.y/H*100}%;width:${size/W*100}%;height:${size/H*100}%`;
   b.setAttribute('aria-label',`珠位 ${i+1}，${color===null?'空位':COLORS[color].name}，可拖动换位`);
   b.onclick=()=>{if(b._dragged){b._dragged=false;return;}if(interactive())tapSlot(i);};
   b.onpointerdown=e=>{
    if(!pointer)ignoreSlotClickUntil=0;
    if(!interactive()||pointer||(e.pointerType==='mouse'&&e.button!==0)||color===null)return;
    b._dragged=false;pointer={id:e.pointerId,from:i,color,button:b,x:e.clientX,y:e.clientY,dragging:false,touch:e.pointerType==='touch'};b.setPointerCapture(e.pointerId);
   };
   b.onpointermove=e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    if(!pointer.dragging&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>(pointer.touch?10:5)){
     pointer.dragging=true;b._dragged=true;movingFrom=null;board.beginDesignDrag(i,color,board.point(e.clientX,e.clientY),pointer.touch);tone('pick',{color});status('拖到空位即可移动；拖到另一颗上即可交换。');
    }
    if(pointer.dragging){const target=slotAt(e.clientX,e.clientY);board.moveDrag(board.point(e.clientX,e.clientY),target===null?null:{type:'design',index:target},target!==null&&target!==i);e.preventDefault();}
   };
   b.onpointerup=e=>{
    if(!pointer||pointer.id!==e.pointerId)return;const down=pointer;pointer=null;
    if(down.dragging){ignoreSlotClickUntil=performance.now()+500;const target=slotAt(e.clientX,e.clientY),drag=board.releaseDrag();if(target!==null&&target!==i)rearrange(i,target,drag?.point);else{board.animate(color,drag?.point??designPos(i),designPos(i),{key:`design-${i}`,returning:true,endSize:designBeadSize()});tone('reject',{color,strength:.35});status('请拖到手串珠位上，珠子已回到原位。');}setTimeout(()=>b._dragged=false,0);}
   };
   b.onpointercancel=b.onlostpointercapture=e=>{if(pointer?.id===e.pointerId)cancel();};if(!b.isConnected)layer.append(b);
  });
  const launcher=$('#design-launch')??document.createElement('button'),p=launcherPos();launcher.className='board-hit launcher-hit';launcher.id='design-launch';launcher.setAttribute('aria-label',selectedColor===null?'取下模式，请选择材料':`弹射${COLORS[selectedColor].name}到下一个空珠位`);launcher.style.cssText=`left:${p.x/W*100}%;top:${p.y/H*100}%;width:${112/W*100}%;height:${112/H*100}%`;launcher.onclick=()=>{if(!interactive())return;if(moveMode||selectedColor===null){status('先在珠宝盒中选一颗珠宝，再弹射。');return;}const target=nextSlot();if(target<0){status('手串已经满了。拖动珠子换位，或点珠位替换配珠。');tone('reject');return;}place(target);};if(!launcher.isConnected)layer.append(launcher);
  if(focused!==undefined)layer.querySelector(`[data-slot="${focused}"]`)?.focus({preventScroll:true});
 }
 function slotAt(clientX,clientY){const p=board.point(clientX,clientY);let closest=null,distance=designBeadSize()*.49;for(let i=0;i<12;i++){const q=designPos(i),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<distance){closest=i;distance=d;}}return closest;}
 function remember(next){history.push([...draft]);draft=next;resumable=null;progress.workshop.draft=[...draft];save();}
 function place(i){
  const before=draft,next=placeBead(before,i,selectedColor);
  if(!next){tone('reject');status('这份材料已用完。可以先取下一颗，或换一种搭配。');return;}
  if(next[i]===before[i]){status('这里已经是这颗珠子了。拖动它可以调整位置。');return;}
  const color=selectedColor;board.cancelFlights([i]);remember(next);selectedSlot=i;refresh();
  status(designWon(next)?'每一条心意都照顾到了，可以交付。':color===null?'珠子已回到珠宝盒，可以重新搭配。':`${COLORS[color].name}已弹射到 ${i+1} 号位。直接拖动即可换位。`);
  if(color!==null){tone('launch',{color});board.animate(color,launcherPos(),designPos(i),{key:`design-${i}`,target:{type:'design',index:i},launch:true,endSize:designBeadSize(),onImpact:()=>tone('land',{color,target:'order',pan:(designPos(i).x/W-.5)*.8})});}else tone('undo');
 }
 function rearrange(from,to,point){
  const slots=draft,next=swapBeads(slots,from,to);if(!next)return;
  const color=slots[from],other=slots[to];board.cancelFlights([from,to]);remember(next);movingFrom=null;selectedSlot=to;refresh();
  board.animate(color,point??designPos(from),designPos(to),{key:`design-${to}`,target:{type:'design',index:to},endSize:designBeadSize(),onImpact:()=>tone('land',{color,strength:.8})});
  if(other!==null)board.animate(other,designPos(to),designPos(from),{key:`design-${from}`,target:{type:'design',index:from},endSize:designBeadSize()});
  status(other===null?'珠子已移动，材料数量没有改变。':'两颗珠子已交换位置。还可以继续调整。');
 }
 function tapSlot(i){if(!moveMode){place(i);return;}if(movingFrom===null){if(draft[i]===null){status('先选一颗已经串上的配珠，再点目标位置。');return;}movingFrom=i;refresh();status('已选中这颗配珠。再点另一个珠位即可移动或交换。');}else if(movingFrom===i){movingFrom=null;refresh();}else rearrange(movingFrom,i);}
 function cancel(){if(pointer){const p=pointer;pointer=null;p.button._dragged=false;if(p.button.hasPointerCapture(p.id))p.button.releasePointerCapture(p.id);}board.cancelDrag();movingFrom=null;}
 function undo(){if(!history.length||!interactive())return;cancel();board.cancelFeedback();draft=history.pop();progress.workshop.draft=[...draft];selectedSlot=null;save();refresh();status('已撤销一步，珠子和材料都已恢复。');tone('undo');}
 document.querySelectorAll('[data-material]').forEach(b=>b.onclick=()=>{cancel();selectedColor=b.dataset.material==='remove'?null:Number(b.dataset.material);moveMode=false;tone('pick',{color:selectedColor??3});refresh();status(selectedColor===null?'取下模式：点一颗配珠，将它收回珠宝盒。':`${COLORS[selectedColor].name}已装入发射座。点蓝色发射座弹射，也可以点指定珠位。`);});
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));refresh();$('.design-materials').scrollTop=0;});
 $('#design-move').onclick=()=>{cancel();moveMode=!moveMode;refresh();status(moveMode?'换位模式：先点串上的配珠，再点另一个珠位。也可以直接拖动。':'选择材料，再从发射座弹射。');};
 $('#design-resume').onclick=()=>{if(!resumable||!interactive())return;cancel();board.cancelFeedback();draft=[...resumable];resumable=null;history=[];selectedSlot=null;refresh();status('已载入上次搭配，可以继续调整。');};
 $('#design-undo').onclick=undo;
 $('#design-reset').onclick=()=>{cancel();openModal('<div class="eyebrow">重新搭配</div><h2>把配珠放回珠宝盒？</h2><p>清空全部十二个珠位，从空串重新搭配。已收藏的作品和金币会保留。</p><div class="modal-actions"><button class="secondary" data-close>继续搭配</button><button class="primary" id="design-confirm-reset">放回珠宝盒</button></div>');$('#design-confirm-reset').onclick=()=>{closeModal();board.cancelFeedback();remember(freshDesign());selectedSlot=null;refresh();status('手串已清空，选一颗珠宝开始弹射。');};};
 $('#design-submit').onclick=()=>{
  cancel();const failed=designChecks(draft).filter(r=>!r.ok);if(failed.length){status(`还差一点：${failed.map(r=>r.label).join('；')}。`);tone('reject');return;}
  board.cancelFeedback();const result=finishDesign({...progress.workshop,draft},progress.coins);Object.assign(progress,{workshop:result.workshop,coins:result.coins});save();refresh();tone('win');tone('coin');
  openModal(`<div class="eyebrow">特别委托完成 · 这是你的搭配</div><h2>旧珠还在，海也回来了。</h2><div class="showcase-tray tray-${progress.workshop.tray}">${designBracelet(progress.workshop.design,art)}</div><div class="coin-settlement"><span class="coin-medallion">✦</span><strong>${result.reward?'+240':'作品已更新'}</strong><small>${result.reward?'首次交付金币':'首次奖励已领取，重新搭配不重复发币'}</small><div class="coin-total">累计金币 <b>${progress.coins}</b></div></div><p>“熟悉的旧珠还在，新的颜色也有了自己的位置。” — 林女士</p><div class="modal-actions"><button class="secondary" data-close>再欣赏一会</button><button class="primary" id="design-display">放进我的橱窗</button></div>`,true);$('#design-display').onclick=()=>showroom(ctx);
 };
 $('#board').addEventListener('board-layout',()=>{cancel();$('.design-letter').open=innerWidth>600;refresh();});
 $('#board').addEventListener('board-restored',()=>{refresh();toast('工作台已恢复，你的搭配还在。');});
 // Complete touch taps on pointerup, including the first tap after a cancelled drag.
 let buttonTouch=null,lastTouchButton=null,lastTouchTime=0;
 app.addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(e.pointerType==='touch'&&e.isPrimary&&b&&!b.dataset.slot){buttonTouch={button:b,id:e.pointerId,x:e.clientX,y:e.clientY};lastTouchButton=null;}},{signal:listeners.signal});
 app.addEventListener('pointerup',e=>{
  const p=buttonTouch;if(!p||p.id!==e.pointerId)return;buttonTouch=null;
  if(p.button!==e.target.closest('button')||p.button.disabled||Math.hypot(e.clientX-p.x,e.clientY-p.y)>8||!interactive())return;
  lastTouchButton=p.button;lastTouchTime=performance.now();p.button.click();e.preventDefault();
 },{signal:listeners.signal});
 app.addEventListener('pointercancel',()=>buttonTouch=null,{signal:listeners.signal});
 app.addEventListener('click',e=>{if(e.isTrusted&&e.detail>0&&e.target.closest('button')===lastTouchButton&&performance.now()-lastTouchTime<500){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,signal:listeners.signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();},{signal:listeners.signal});window.addEventListener('blur',cancel,{signal:listeners.signal});
 refresh();return {undo,refresh,cancel,dispose:()=>{cancel();listeners.abort();},text:()=>({slots:draft,hasSavedDraft:!!resumable,selectedColor,selectedSlot,moveMode,movingFrom,filter,launcher:launcherPos(),materials:MATERIALS.map(m=>({...m,name:COLORS[m.color].name,remaining:remaining(draft,m.color)})),checks:designChecks(draft),targets:draft.map((_,i)=>designPos(i)),savedDesign:progress.workshop.design,tray:progress.workshop.tray,rewarded:progress.workshop.rewarded})};
}
