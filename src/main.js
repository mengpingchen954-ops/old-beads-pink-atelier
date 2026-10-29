import './style.css';
import './design.css';
import './pink.css';
import './match.css';
import {renderHome} from './home-ui.js';
import {braceletLayout,BRACELET_SITES} from './jewelry.js';
import {COLORS,loadProgress} from './model.js';
import {matchLevels as levels,SLOTS,COLOR_FAMILIES,FAMILY_NAMES,createMatchState as createState,cloneMatch as clone,matchColor as colorAt,canPlace as legal,matchWon as won,placeMatch,matchHint,validMatchSession} from './match-model.js';
import {CONSTRUCTION_AREAS,repairedCount,unlockedAreas} from './construction.js';
import {levels as artworkLevels} from './levels.js';
import {chapters,customers,commissions} from './content.js';
import {Board,matchPos,matchBeadSize,W,H} from './renderer.js';
import {AtelierAudio,MUSIC_TRACKS} from './audio.js';
import {showroom,designBracelet} from './design-ui.js';
import {mountDesigner} from './design-workbench.js';
import {art} from './art.js';
const $=s=>document.querySelector(s),base=import.meta.env.BASE_URL;
const icons={undo:'<path d="M9 6L4 11l5 5M4 11h9a6 6 0 010 12"/>',reset:'<path d="M19 8A8 8 0 105 19M19 3v6h-6"/>',hint:'<path d="M8 17c0-4-3-4-3-8a7 7 0 0114 0c0 4-3 4-3 8M8 20h8M10 23h4"/>',book:'<path d="M12 5Q7 1 2 4v16q5-3 10 1 5-4 10-1V4q-5-3-10 1v16"/>',sound:'<path d="M11 4L6 8H2v8h4l5 4ZM16 7a7 7 0 010 10M19 3a12 12 0 010 18"/>',home:'<path d="M3 11L12 3l9 8M6 9v12h12V9M10 21v-7h4v7"/>',arrow:'<path d="M4 12h16M14 6l6 6-6 6"/>',close:'<path d="M5 5l14 14M19 5L5 19"/>',full:'<path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/>'};
const icon=(name)=>`<svg viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.arrow}</svg>`;
const app=$('#app');
let progress;try{progress=loadProgress(localStorage);}catch{progress={completed:[],coins:0,sound:true,session:null};}
let busyUntil=0;
let mode='home',index=0,state,history=[],selected=null,hint=null,board,boardLoading,modal=false,usedHint=false,lastReward=0,designer=null,designGeneration=0;
const audio=new AtelierAudio(progress);let saveWarning=false,completionTimer,activePointer=null,soundGestureTimer=null;
audio.onTrackChange=()=>{save();refreshMusicPicker();};
function clearSoundGesture(){clearTimeout(soundGestureTimer);soundGestureTimer=null;}
function tone(type='pick',options={}){audio.play(type,options);}
function syncAudio(){audio.setActive(!document.hidden);}
function cancelPointer(){designer?.cancel();activePointer=null;document.querySelectorAll('[data-source]').forEach(b=>{if(b._down){b._down=null;b._dragged=true;}});board?.cancelDrag();}
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearSoundGesture();cancelPointer();audio.suspend();}else{syncAudio();}});
let syntheticUIClick=false;
document.addEventListener('pointerdown',()=>{syntheticUIClick=false;audio.unlock();},{passive:true});
document.addEventListener('keydown',()=>audio.unlock());
// Complete touch taps before a redraw can move the native click onto a new bead.
let touchTap=null,suppressTouchClick=false;
document.addEventListener('pointerdown',e=>{suppressTouchClick=false;touchTap=e.pointerType==='touch'?{button:e.target.closest('.atelier-game button'),x:e.clientX,y:e.clientY,id:e.pointerId}:null;},true);
document.addEventListener('keydown',()=>{suppressTouchClick=false;});
document.addEventListener('pointercancel',()=>{touchTap=null;});
document.addEventListener('pointerup',e=>{
 const tap=touchTap;touchTap=null;
 if(!tap||tap.id!==e.pointerId||!tap.button?.isConnected||tap.button.disabled||e.defaultPrevented||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8)return;
 tap.button.click();suppressTouchClick=true;e.preventDefault();
});
document.addEventListener('click',e=>{if(suppressTouchClick&&e.isTrusted){e.preventDefault();e.stopImmediatePropagation();}},true);
// Run after the action so existing bead/reward sounds and touch click suppression take priority.
const uiClickStarts=new WeakMap();
document.addEventListener('click',e=>uiClickStarts.set(e,audio.sequence),true);
document.addEventListener('click',e=>{
 const control=e.target.closest('button,a[href],summary,input[type="checkbox"],input[type="radio"],select');
 if(!control||control.matches(':disabled,[aria-disabled="true"],.board-hit'))return;
 if(!e.composedPath().some(el=>el===app||el.id==='modal'))return;
 // The designer completes touch taps with click(); navigation can also emit a native touch click.
 if(e.isTrusted&&e.pointerType==='touch'&&syntheticUIClick)return;
 if(!e.isTrusted)syntheticUIClick=true;
 if(uiClickStarts.get(e)!==audio.sequence)return;
 const sound=control.matches('[data-close],#go-home,#design-home')?'ui-back':control.matches('.primary')?'ui-confirm':control.matches('input,select,#design-move')?'ui-toggle':'ui-tap';
 tone(sound);
});
let lastSliderSound=-Infinity;
document.addEventListener('input',e=>{
 if(!e.target.matches('input[type="range"]')||performance.now()-lastSliderSound<90)return;
 lastSliderSound=performance.now();tone('ui-tap',{strength:.45});
});
function save(){try{localStorage.setItem('old-beads-pink-v1',JSON.stringify({version:1,...progress}));}catch{if(!saveWarning){saveWarning=true;toast('浏览器暂不能保存。当前仍可游玩，请尽量保持页面打开。');}}}
function saveSession(){progress.matchSession={mode:'match-v1',level:index,state:clone(state),history:history.slice(-60),usedHint};save();}
function toast(text){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.role='status';document.body.append(t);}t.textContent=text;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3300);}
function restoreValid(session){return validMatchSession(session);}
function nextIndex(){return Math.min(11,Array.from({length:12},(_,i)=>i).find(i=>!progress.completed.includes(i))??11);}
function beadHTML(c,size=25){return `<img class="bead-icon" draggable="false" width="${size}" height="${size}" src="${art(COLORS[c].file)}" alt="${COLORS[c].name}${COLORS[c].symbol}">`;}
function braceletHTML(order,extra=''){
 const layout=braceletLayout(order);
 return '<div class="bracelet '+extra+'" role="img" aria-label="月光石底珠与'+order.map(c=>COLORS[c].name).join('、')+'搭配的十八珠手串"><span class="bracelet-thread"></span>'+layout.map(({color,x,y,goalIndex,angle})=>{
 const a=angle+Math.PI/BRACELET_SITES;
 return '<img src="'+art(COLORS[color].file)+'" alt="" style="left:'+(50+x*34.5)+'%;top:'+(50+y*34.5)+'%">'+(goalIndex>=0?'<span class="bracelet-spacer" style="left:'+(50+Math.cos(a)*34.5)+'%;top:'+(50+Math.sin(a)*34.5)+'%;transform:translate(-50%,-50%) rotate('+a+'rad)"></span>':'');
 }).join('')+'<span class="bracelet-knot"></span></div>';
}
function matchBraceletHTML(ring){return '<div class="bracelet" role="img" aria-label="自由配色手串"><span class="bracelet-thread"></span>'+ring.map((color,j)=>{const a=-Math.PI/2+Math.PI/8+j*Math.PI/4;return '<img alt="'+COLORS[color].name+'" src="'+art(COLORS[color].file)+'" style="left:'+(50+Math.cos(a)*34.5)+'%;top:'+(50+Math.sin(a)*34.5)+'%">';}).join('')+'</div>';}
function worksHTML(n){return progress.matchWorks?.[n]?.map(matchBraceletHTML).join('')??artworkLevels[n].orders.map(a=>braceletHTML(a)).join('');}
function home(){
 closeModal();clearSoundGesture();designGeneration++;designer?.dispose();designer=null;mode='home';activePointer=null;index=nextIndex();clearTimeout(completionTimer);board?.cancelFeedback();board?.resizeObserver.disconnect();syncAudio();
 renderHome({app,progress,base,level:index,title:commissions[index].title,openModal,closeModal,save,tone,toast,startOrder:()=>{if(restoreValid(progress.matchSession))start(progress.matchSession.level,true);else start(nextIndex());},startLevel:start,designer:startDesigner,gallery,showcase:()=>showroom(designContext()),help,sound:audioSettings});scrollTo(0,0);
}
function designContext(generation=designGeneration){return {app,progress,art,save,tone,toast,openModal,closeModal,home,start:startDesigner,toggleSound,active:()=>mode==='design'&&generation===designGeneration,ensureBoard:async()=>{await ensureBoard();return board;}};}
async function startDesigner(){closeModal();designer?.dispose();const generation=++designGeneration;mode='design';designer=null;selected=null;hint=null;activePointer=null;clearTimeout(completionTimer);board?.cancelFeedback();board?.resizeObserver.disconnect();const view=await mountDesigner(designContext(generation));if(generation===designGeneration&&mode==='design')designer=view;else view?.dispose();syncAudio();}
async function ensureBoard(){try{if(board)board.mount($('#board'));else{board=new Board($('#board'));board.onContact=(color,x)=>tone('land',{color,pan:(x/W-.5)*1.1,strength:.35});boardLoading=board.load();}await boardLoading;}catch(error){board=null;const host=$('#board');if(host)host.innerHTML=`<div class="gpu-error"><h2>工作台暂时未能打开</h2><p>需要浏览器 WebGL 支持。请尝试更新浏览器或开启硬件加速，然后重试。</p><button class="primary" onclick="location.reload()">重新载入</button></div>`;console.error(error);throw error;}}
async function start(n,resume=false){
 clearSoundGesture();
 designGeneration++;designer?.dispose();designer=null;
 index=n;mode='play';busyUntil=0;selected=null;hint=null;history=[];usedHint=false;activePointer=null;
 if(resume&&restoreValid(progress.matchSession)){state=clone(progress.matchSession.state);usedHint=!!progress.matchSession.usedHint;history=(Array.isArray(progress.matchSession.history)?progress.matchSession.history:[]).slice(-60).filter(s=>restoreValid({mode:'match-v1',level:n,state:s})).slice(-60);}else state=createState(levels[n]);
 const c=commissions[index],client=customers[c.client],ch=chapters[Math.floor(index/4)];
 if(board){board.resizeObserver.disconnect();board.cancelFeedback();}clearTimeout(completionTimer);
 app.innerHTML=`<main class="game-shell atelier-game"><header class="atelier-top"><button class="back-shop" id="go-home">${icon('home')}<span>回小店</span></button><div class="level-scroll"><small>第 ${index+1} 关 · ${ch.title}</small><h1>${c.title}</h1></div><div class="top-tools"><span class="play-coins">✦ ${progress.coins}</span><button class="icon-button" id="gallery-btn" aria-label="打开作品与来信">${icon('book')}</button><button class="icon-button" id="help-btn" aria-label="玩法说明">?</button><button class="icon-button" id="sound-btn" aria-label="单击切换下一首，双击调节音量" title="单击切换下一首，双击调节音量">${icon('sound')}</button></div></header><div class="atelier-layout"><aside class="story-sidebar client-letter"><div class="letter-pin">✿</div><div class="portrait-wrap"><img src="${art(client.portrait)}" alt="顾客${client.name}" class="portrait"></div><div class="client-name">${client.name}<small>${client.role}</small></div><blockquote class="client-note">“自由选珠，自由摆放。三颗相邻同色系，收集每一份心意。”</blockquote><button class="sidebar-link" id="open-story">展开来信 ${icon('arrow')}</button><div class="sidebar-bottom"><span class="tiny-label">首次交付</span><strong>★ 1 枚建造星</strong><p>修好一个角落，留住一份心意。</p><div class="progress-dots">${commissions.map((_,i)=>`<i class="${progress.completed.includes(i)?'complete':i===index?'active':''}"></i>`).join('')}</div><span class="chapter-progress">委托进度 ${progress.completed.length} / 12</span></div></aside><section class="work-area"><div class="instruction" id="instruction" role="status">任意选珠 → 任意珠位 · 相邻三颗同色系即可消除</div><div id="collection-goals" class="collection-goals" aria-label="本关收集目标"></div><div class="board-wrap" id="board"><div id="hit-layer" class="hit-layer" aria-label="珠饰工作台"></div></div><section class="match-palette"><div class="match-palette-heading"><b>随心配珠</b><small>任意选 · 用后自动补充</small></div><div id="match-materials" class="match-materials" aria-label="自由选择配珠"></div></section><footer class="work-footer"><div class="action-tools"><button id="undo-btn" class="tool">${icon('undo')}<span>撤销</span><kbd>Z</kbd></button><button id="restart-btn" class="tool">${icon('reset')}<span>重来</span></button><button id="hint-btn" class="tool">${icon('hint')}<span>一点灵感</span></button></div><span class="move-count" id="move-count">0 步</span><button id="fullscreen-btn" class="icon-button fullscreen-btn" aria-label="切换全屏">${icon('full')}</button></footer><div class="material-legend"><span>不计时 · 不限步数 · 进度自动保存</span></div></section></div></main>`;
 scrollTo(0,0);$('#go-home').onclick=()=>{saveSession();home();};$('#gallery-btn').onclick=()=>gallery();$('#help-btn').onclick=help;bindSoundButton();$('#undo-btn').onclick=undo;$('#restart-btn').onclick=()=>confirmRestart();$('#hint-btn').onclick=giveHint;$('#open-story').onclick=()=>story();$('#fullscreen-btn').onclick=toggleFullscreen;
 const settings=document.createElement('button');settings.className='text-button sound-settings';settings.id='audio-settings';settings.textContent='声音调校';settings.onclick=audioSettings;$('.material-legend').append(settings);
 $('#board').addEventListener('board-layout',()=>refresh());
 $('#board').addEventListener('board-lost',()=>{toast('画面连接中断，请稍候恢复。你的操作进度仍在。');});
 $('#board').addEventListener('board-restored',()=>toast('工作台已恢复。'));
 await ensureBoard();if(mode!=='play')return;renderPalette();refresh();saveSession();syncAudio();
 if(won(state,levels[index]))complete();else if(!resume)story();
}
function sourcePoint(source){
 if(source.type==='ring')return matchPos(source.index);
 const b=document.querySelector('[data-source="palette-'+source.index+'"]').getBoundingClientRect();return board.point(b.x+b.width/2,b.y+b.height/2);
}
function bindSource(button,source){
 button.dataset.source=source.type+'-'+source.index;
 button.onclick=()=>{if(button._dragged){button._dragged=false;return;}if(source.type==='ring'&&selected)transfer({type:'slot',index:source.index});else choose(source);};
 button.onpointerdown=e=>{if(modal||mode!=='play'||performance.now()<busyUntil||activePointer!==null||(e.pointerType==='mouse'&&e.button!==0))return;activePointer=e.pointerId;button._dragged=false;button._down={x:e.clientX,y:e.clientY,id:e.pointerId};button.setPointerCapture(e.pointerId);};
 button.onpointermove=e=>{
  const d=button._down;if(!d||d.id!==e.pointerId)return;
  if(!board.drag&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>8){board.beginMatchDrag(source,colorAt(state,source),board.point(e.clientX,e.clientY),sourcePoint(source),e.pointerType==='touch');tone('pick',{color:colorAt(state,source)});button._dragged=true;}
  if(board.drag){const target=targetAt(e.clientX,e.clientY);board.moveDrag(board.point(e.clientX,e.clientY),target,target?legal(state,levels[index],source,target):false);}
 };
 button.onpointerup=e=>{
  const d=button._down;if(!d||d.id!==e.pointerId)return;button._down=null;activePointer=null;if(!board.drag)return;
  const target=targetAt(e.clientX,e.clientY);selected=source;
  if(target)transfer(target);else{board.cancelDrag();tone('reject',{color:colorAt(state,source),strength:.4});}e.preventDefault();
 };
 button.onpointercancel=button.onlostpointercapture=e=>{if(activePointer===e.pointerId){activePointer=null;button._down=null;board.cancelDrag();}};
}
function targetAt(x,y){const el=document.elementFromPoint(x,y)?.closest('[data-target]');if(!el)return null;return {type:'slot',index:Number(el.dataset.target.split('-')[1])};}
function renderPalette(){
 const host=$('#match-materials');host.style.setProperty('--palette-cols',Math.min(5,levels[index].palette.length));
 host.innerHTML=levels[index].palette.map(c=>'<button class="match-material" aria-label="选择'+COLORS[c].name+'，'+FAMILY_NAMES[COLOR_FAMILIES[c]]+'" aria-pressed="false">'+beadHTML(c,45)+'<b>'+COLORS[c].name+'</b><small>'+FAMILY_NAMES[COLOR_FAMILIES[c]]+'</small></button>').join('');
 [...host.children].forEach((button,i)=>bindSource(button,{type:'palette',index:levels[index].palette[i]}));
}
function refresh(){
 if(!board||mode!=='play')return;const level=levels[index];board.draw(state,level,selected,hint);
 const focused=document.activeElement?.dataset?.source,layer=$('#hit-layer');layer.innerHTML='';
 state.rings.forEach((ring,r)=>ring.forEach((color,j)=>{
  const i=r*SLOTS+j,p=matchPos(i),button=document.createElement('button');button.className='board-hit';button.dataset.target='slot-'+i;button.setAttribute('aria-label','手串'+(r+1)+'，珠位'+(j+1)+'，'+COLORS[color].name+'；可放入或交换');button.style.cssText='left:'+p.x/W*100+'%;top:'+p.y/H*100+'%;width:'+96/W*100+'%;height:'+96/H*100+'%';bindSource(button,{type:'ring',index:i});layer.append(button);
 }));
 if(focused)layer.querySelector('[data-source="'+focused+'"]')?.focus({preventScroll:true});
 $('#collection-goals').innerHTML='<div class="collection-heading"><b>本关收集</b><small>'+level.goals.filter(g=>state.collected[g.color]>=g.count).length+' / '+level.goals.length+' 种完成</small></div><div class="collection-items">'+level.goals.map(g=>{const count=Math.min(g.count,state.collected[g.color]),done=count===g.count;return '<div class="collection-item '+(done?'done':'')+'" data-goal="'+g.color+'" aria-label="'+COLORS[g.color].name+'，已收集'+count+'，目标'+g.count+'">'+beadHTML(g.color,32)+'<span>'+COLORS[g.color].name+'<b>'+count+' / '+g.count+(done?' ✓':'')+'</b></span><i style="--progress:'+count/g.count*100+'%"></i></div>';}).join('')+'</div>';
 document.querySelectorAll('#match-materials [data-source]').forEach(b=>{const c=Number(b.dataset.source.split('-')[1]);b.setAttribute('aria-pressed',String(selected?.type==='palette'&&selected.index===c));b.classList.toggle('hinted',hint?.source.index===c);});
 $('#move-count').textContent=state.moves+' 步';$('#undo-btn').disabled=!history.length;
}
function choose(source){
 if(modal||mode!=='play'||activePointer!==null||board.drag||performance.now()<busyUntil)return;
 hint=null;if(selected?.type===source.type&&selected.index===source.index){selected=null;$('#instruction').textContent='任意选珠，任意摆放。同色系三颗相邻就消除。';}
 else{selected=source;const c=colorAt(state,source);$('#instruction').textContent=COLORS[c].name+' · '+FAMILY_NAMES[COLOR_FAMILIES[c]]+' · '+(source.type==='ring'?'点另一颗珠子交换位置':'点手串任意珠位替换');tone('pick',{color:c});}refresh();
}
function transfer(target){
 if(modal||mode!=='play'||performance.now()<busyUntil)return;
 if(!selected){toast('任意选一颗配珠，再点手串上的任意珠位。');return;}
 const source={...selected},color=colorAt(state,source),result=placeMatch(state,levels[index],source,target);
 if(!result){board.cancelDrag();selected=null;refresh();return;}
 const drag=board.releaseDrag(),from=drag?.point??sourcePoint(source),to=matchPos(target.index);
 history.push(clone(state));history=history.slice(-60);state=result.state;selected=null;hint=null;busyUntil=performance.now()+(board.reduced?0:800);
 $('#instruction').textContent=result.cleared.length?'消除 '+result.cleared.length+' 颗！已计入收集，新的珠子补上了。':'已摆好。继续自由配色，凑出相邻三颗同色系。';refresh();
 if(result.cleared.length)board.matchBurst(result.cleared);
 board.animate(color,from,to,{key:'slot-'+target.index,target,endSize:matchBeadSize(),onImpact:()=>{tone('land',{color,pan:(to.x/W-.5)*1.1});if(result.cleared.length){tone('thread',{strength:.65});board.celebrate(Math.floor(target.index/SLOTS));}}});
 saveSession();if(won(state,levels[index]))complete(board.reduced?100:950);
}
function undo(){if(modal||mode!=='play'||!history.length)return;board.cancelFeedback();busyUntil=0;state=history.pop();selected=null;hint=null;$('#instruction').textContent='已撤销摆放、消除和补珠，收集数量也一起还原。';refresh();saveSession();tone('undo');}
function reset(){board.cancelFeedback();busyUntil=0;state=createState(levels[index]);history=[];selected=null;hint=null;usedHint=false;$('#instruction').textContent='重新开始收集。任意选珠，任意摆放，没有时间限制。';refresh();saveSession();}
function confirmRestart(){openModal(`<div class="eyebrow">重新整理工作台</div><h2>从这一份委托的开头重来？</h2><p>只重置当前委托，已完成的作品都会保留。</p><div class="modal-actions"><button class="secondary" data-close>继续想想</button><button class="primary" id="confirm-reset">重新开始</button></div>`);$('#confirm-reset').onclick=()=>{closeModal();reset();};}
function giveHint(){if(modal||mode!=='play'||performance.now()<busyUntil)return;hint=matchHint(state,levels[index]);if(hint){usedHint=true;selected=null;$('#instruction').textContent='一点灵感：选'+COLORS[hint.source.index].name+'，放到手串'+(Math.floor(hint.target.index/SLOTS)+1)+'的亮圈珠位，向收集目标靠近。';refresh();saveSession();tone('ui-tap');}}
let previousFocus;
function openModal(html,wide=false){
 clearSoundGesture();if($('#modal'))closeModal();cancelPointer();previousFocus=document.activeElement;modal=true;syncAudio();app.inert=true;const el=document.createElement('div');el.id='modal';el.className='modal-backdrop petal-modal';el.innerHTML=`<section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="工坊小笺" tabindex="-1"><button class="modal-close icon-button" data-close aria-label="关闭窗口">${icon('close')}</button>${html}</section>`;document.body.append(el);el.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);el.addEventListener('keydown',e=>{if(e.key==='Tab'){const nodes=[...el.querySelectorAll('button:not([disabled]),a[href],input')].filter(b=>b.offsetParent!==null);if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});el.querySelector('.modal').focus({preventScroll:true});
}
function closeModal(){const el=$('#modal');if(!el)return;el.remove();modal=false;app.inert=false;syncAudio();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
function story(){const c=commissions[index],client=customers[c.client];openModal(`<div class="letter-layout"><img class="letter-portrait" src="${art(client.portrait)}" alt="${client.name}"><div><div class="eyebrow">${chapters[Math.floor(index/4)].label} · 委托 ${index+1}</div><h2>${c.title}</h2><p>${c.before}</p><span class="letter-sign">— ${client.name}的来信</span><button class="primary" id="accept-order">收下这份委托 ${icon('arrow')}</button></div></div>`);$('#accept-order').onclick=()=>{closeModal();if(index===0&&state.moves===0){$('#instruction').textContent='先选喜欢的配珠，再点手串任意一颗；连续三颗同色系会消除。';}};}
function help(){openModal('<div class="eyebrow">随心配色 · 手串三消</div><h2>自由摆，慢慢收集。</h2><ol class="help-list"><li><b>任意选，任意放</b><p>下方配珠全部可选，点选或拖到手串任意珠位，直接替换原珠。也可先点手串上的珠子，再点另一颗交换。</p></li><li><b>三颗相邻，同色系消除</b><p>同一条手串上，连续三颗或更多同色系珠子自动消除，首尾相邻也算。粉晶与红玛瑙、绿幽灵与绿松石、金发晶与黄水晶、紫水晶与烟晶分别可混搭消除。月光石、海蓝宝各自成组。配珠下方标有色系。</p></li><li><b>收齐数量就通关</b><p>消除按每颗珠子的实际材质计入上方目标。例如两颗粉晶与一颗红玛瑙一起消除，分别收集粉晶两颗、红玛瑙一颗。消除位置自动补珠，配珠持续供应，替换本身不计数。</p></li></ol><p class="muted">不计时、不限步数。撤销同时还原收集和补珠；一点灵感会标出建议珠位。Tab 选择、Enter 确认、Z 撤销、Esc 关闭、F 全屏。首次通关仍获得金币和建造星。</p><button class="primary" data-close>开始随心配色</button>');}
function complete(delay=0){
 mode='complete';syncAudio();progress.matchWorks??=[];progress.matchWorks[index]=state.rings.map(r=>[...r]);const firstClear=!progress.completed.includes(index),reward=firstClear?100+index*20+(usedHint?0:25):0;lastReward=reward;if(firstClear){progress.completed.push(index);progress.coins+=reward;}progress.matchSession=null;save();
 completionTimer=setTimeout(()=>{tone('win');const c=commissions[index],last=index===11,star=firstClear?1:0; tone('coin',{strength:1.1});openModal(`<div class="petal-reward-head"><span>✿</span><div class="eyebrow">委托完成 · ${firstClear?'获得建造星':'重新串起'}</div><span>✦</span></div><h2>${last?'旧物有光，约定有回响。':c.title}</h2><div class="reward-bracelets">${worksHTML(index)}</div><div class="match-reward-summary">${levels[index].goals.map(g=>beadHTML(g.color,24)+' '+COLORS[g.color].name+' '+Math.min(state.collected[g.color],g.count)+' / '+g.count+' ✓').join('　')}</div><div class="reward-wallet"><div class="coin-settlement"><span class="coin-medallion">✦</span><strong>${firstClear?`+${reward}`:'已领取'}</strong><small>${firstClear?'金币已收入小店':'本关金币已领取'}</small><div class="coin-total">累计金币 <b>${progress.coins}</b></div></div><div class="star-award"><b>${star?'★':'☆'}</b><span>${star?'建造星 +1':'建造星已领取'}</span><small>${star?'回小店修复一个新角落':'首次完成委托才会获得建造星'}</small></div></div><p class="reward-story">${c.after}</p><div class="modal-actions"><button class="secondary" id="reward-home">回小店建设</button><button class="primary" id="next-order">${last?'打开作品册':'迎接下一位来客'} ${icon('arrow')}</button></div>`);$('#modal .modal-close').hidden=true;$('#reward-home').onclick=()=>{closeModal();home();};$('#next-order').onclick=()=>{closeModal();if(last){home();gallery();}else start(index+1);};},delay);
}
function gallery(){
 openModal(`<div class="petal-gallery-head"><span>✿</span><div><div class="eyebrow">作品纪念册 · ${progress.completed.length}/12</div><h2>把每一份心意，收进作品册。</h2></div><span>✦</span></div><div class="gallery-grid">${commissions.map((c,i)=>{const done=progress.completed.includes(i),unlocked=i===0||progress.completed.includes(i-1)||done;return `<button class="gallery-item ${done?'done':''}" data-level="${i}" ${unlocked?'':'disabled'}>${done?(progress.matchWorks?.[i]?matchBraceletHTML(progress.matchWorks[i][0]):braceletHTML(artworkLevels[i].orders[0],'small')):`<div class="locked-art">${unlocked?'✧':'·'}</div>`}<span>${String(i+1).padStart(2,'0')} / ${chapters[Math.floor(i/4)].label}</span><strong>${c.title}</strong><small>${done?c.keepsake:unlocked?'可以开始':'待前一份委托交付'}</small></button>`;}).join('')}</div><p class="muted">点已完成作品可回看交付来信。交付的每件手串，都会保存在这里。</p>`,true);
 $('#modal').querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.level);if(progress.completed.includes(n)){const c=commissions[n];openModal(`<div class="eyebrow">工坊收藏 · ${c.keepsake}</div><h2>${c.title}</h2><div class="reward-bracelets">${worksHTML(n)}</div><p>${c.after}</p><div class="modal-actions"><button class="secondary" id="back-gallery">回作品册</button><button class="primary" id="replay">重新制作</button></div>`);$('#back-gallery').onclick=gallery;$('#replay').onclick=()=>{closeModal();start(n);};}else{closeModal();start(n);}});
}
function nextMusicFromButton(){const next=(audio.track+1)%MUSIC_TRACKS.length;audio.selectMusic(next);toast(`已切换：${MUSIC_TRACKS[next].title}`);}
function bindSoundButton(){
 const button=$('#sound-btn');if(!button)return;
 button.onclick=()=>{
  if(soundGestureTimer!==null){clearSoundGesture();audioSettings();return;}
  // Wait for a second mouse click or touch tap before committing a track change.
  soundGestureTimer=setTimeout(()=>{soundGestureTimer=null;nextMusicFromButton();},400);
 };
}
function toggleSound(){progress.sound=!progress.sound;save();audio.apply();const control=$('#sound-toggle');if(control){control.checked=progress.sound;control.setAttribute('aria-checked',String(progress.sound));}if(progress.sound)tone('ui-toggle');toast(progress.sound?'珠声已开启':'珠声已关闭');}
function refreshMusicPicker(){
 const current=$('#music-current');if(current)current.textContent=`已选：${audio.status().track}`;
 document.querySelectorAll('[data-music-track]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.musicTrack)===audio.track)));
}
function audioSettings(){
 openModal(`<div class="eyebrow">听见手作的温度</div><h2>工坊的声音</h2><p>轻取水晶，听一声清脆的回响。珠子接触手链与木盘时，会有不同的轻碰与余响。</p><label class="audio-control" for="volume-slider">整体音量 <output id="volume-value">${Math.round((progress.volume??.7)*100)}%</output></label><input id="volume-slider" type="range" min="0" max="100" value="${Math.round((progress.volume??.7)*100)}"><label class="audio-control"><span>全部声音<small>关闭后会同时静音珠声与背景音乐</small></span><input id="sound-toggle" type="checkbox" role="switch" aria-checked="${progress.sound}" ${progress.sound?'checked':''}></label><label class="audio-control"><span>背景音乐<small>6 首治愈音乐，可随时点选切换</small></span><input id="music-toggle" type="checkbox" ${progress.music!==false?'checked':''}></label><div class="music-picker"><div class="music-picker-heading"><span>选择歌曲</span><output id="music-current" aria-live="polite"></output></div><div class="music-track-list" role="group" aria-label="背景音乐选曲">${MUSIC_TRACKS.map((track,i)=>`<button type="button" data-music-track="${i}" aria-pressed="${i===audio.track}"><span aria-hidden="true">♫</span>${track.title}</button>`).join('')}</div><small>点选即可切换，播放结束后继续下一首。</small></div><label class="audio-control" for="music-volume-slider">背景音乐音量 <output id="music-volume-value">${Math.round((progress.musicVolume??.35)*100)}%</output></label><input id="music-volume-slider" type="range" min="0" max="100" value="${Math.round((progress.musicVolume??.35)*100)}"><button class="secondary" id="sound-preview">试听珠子轻碰</button><p class="muted">右上角喇叭：单击切换下一首，双击打开这里调节音量。首次点击页面后开始播放，切到后台时自动暂停。</p><div class="modal-actions"><button class="primary" data-close>回到工作台</button></div>`);
 $('.modal').classList.add('audio-modal');refreshMusicPicker();document.querySelectorAll('[data-music-track]').forEach(b=>b.onclick=()=>audio.selectMusic(Number(b.dataset.musicTrack)));
 $('#volume-slider').oninput=e=>{progress.volume=Number(e.target.value)/100;$('#volume-value').textContent=`${e.target.value}%`;audio.apply();save();};
 $('#music-volume-slider').oninput=e=>{progress.musicVolume=Number(e.target.value)/100;$('#music-volume-value').textContent=`${e.target.value}%`;audio.apply();save();};
 $('#sound-toggle').onchange=toggleSound;
 $('#music-toggle').onchange=e=>{progress.music=e.target.checked;audio.apply();save();};
 $('#sound-preview').onclick=()=>{if(!progress.sound)toggleSound();tone('land',{color:1});};
}
function toggleFullscreen(){if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>toast('当前浏览器暂不支持全屏。'));else document.exitFullscreen?.();}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(mode==='complete')return;if(modal)closeModal();else if(mode==='design'){designer?.cancel();designer?.refresh();}else if(selected||board?.drag){cancelPointer();selected=null;hint=null;refresh();}return;}if(modal)return;if(e.key.toLowerCase()==='z'&&mode==='design'){e.preventDefault();designer?.undo();}if(e.key.toLowerCase()==='z'&&mode==='play'){e.preventDefault();cancelPointer();undo();}if(e.key.toLowerCase()==='f'){e.preventDefault();toggleFullscreen();}});
window.render_game_to_text=()=>JSON.stringify({mode,rule:'match-v1',modal,level:index+1,completed:progress.completed,coins:progress.coins,reward:lastReward,feedback:board?.status(),busy:performance.now()<busyUntil,audio:audio.status(),coordinates:'logical '+W+'x'+H+', origin top-left, x right, y down',design:mode==='design'?designer?.text():null,state,selected,hint,targets:state?{slots:Array.from({length:16},(_,i)=>matchPos(i))}:null,goals:levels[index].goals,palette:levels[index].palette,families:COLOR_FAMILIES,construction:{available:progress.completed.length-repairedCount(progress),repaired:repairedCount(progress),areas:CONSTRUCTION_AREAS.map(a=>({id:a.id,unlocked:unlockedAreas(progress).includes(a.id)}))}});
window.advanceTime=()=>{board?.render();return Promise.resolve();};
home();








