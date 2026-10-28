import * as THREE from 'three';
import {COLORS} from './model.js';
import {flightPoint,launchPoint,rebound} from './feedback.js';
import {accentSlot,braceletLayout,BRACELET_SITES,BRACELET_RADIUS,BRACELET_BEAD_SIZE} from './jewelry.js';
export let W=1000,H=700;
let compact=false;
export const railPos=(i,j=0)=>({x:(compact?140:145)+j*(compact?93:81),y:(compact?150:168)+i*91});
export const bufferPos=(i,capacity)=>({x:compact?(capacity===3?200+i*100:250+i*110):(capacity===3?143+i*100:170+i*110),y:compact?540:580});
export const orderPos=i=>({x:compact?180+i*300:741,y:compact?747:212+i*264});
export function beadPos(i,j,count){const p=orderPos(i),a=-Math.PI/2+accentSlot(j,count)/BRACELET_SITES*Math.PI*2;return {x:p.x+Math.cos(a)*BRACELET_RADIUS,y:p.y+Math.sin(a)*BRACELET_RADIUS};}
export function sourcePos(source,capacity){return source.type==='rail'?railPos(source.index):bufferPos(source.index,capacity);}
export function designPos(i){const a=-Math.PI/2+i*Math.PI/6,r=compact?177:190;return {x:W/2+Math.cos(a)*r,y:(compact?278:305)+Math.sin(a)*r};}
export const launcherPos=()=>({x:W/2,y:compact?622:623});
export const designBeadSize=()=>compact?120:124;
export class Board {
  constructor(host){
    this.host=host;this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(0,W,0,H,.1,100);this.camera.position.z=30;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});this.renderer.setClearColor('#edf7ff');this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.domElement.setAttribute('aria-hidden','true');host.prepend(this.renderer.domElement);
    this.group=new THREE.Group();this.fx=new THREE.Group();this.scene.add(this.group,this.fx);this.effects=[];this.beads=new Map();this.rims=new Map();this.textures={};this.geometry=new THREE.PlaneGeometry(1,1);this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.cancelFeedback();this.host.dispatchEvent(new Event('board-lost'));});
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>{if(this.designView)this.drawDesign(this.designView);else if(this.last)this.draw(...this.last);this.host.dispatchEvent(new Event('board-restored'));});
  }
  mount(host){this.cancelFeedback();this.resizeObserver.disconnect();this.host=host;host.prepend(this.renderer.domElement);this.resizeObserver.observe(host);this.resize();}
  async load(){const loader=new THREE.TextureLoader();await Promise.all(['workbench',...COLORS.map(c=>c.file)].map(async name=>{const t=await loader.loadAsync(`${import.meta.env.BASE_URL}art/${name}.svg`);t.colorSpace=THREE.SRGBColorSpace;this.textures[name]=t;}));}
  resize(){const next=innerWidth<=600,changed=next!==compact;if(changed)this.cancelFeedback();compact=next;W=compact?660:1000;H=compact?(this.designView?740:910):700;this.host.style.aspectRatio=`${W}/${H}`;this.camera.right=W;this.camera.bottom=H;this.camera.updateProjectionMatrix();const r=this.host.getBoundingClientRect();this.renderer.setSize(r.width,r.height,false);if(changed&&(this.last||this.designView)){if(this.designView)this.drawDesign(this.designView);else this.draw(...this.last);this.host.dispatchEvent(new Event('board-layout'));}else this.render();}
  clear(){for(const o of [...this.group.children]){this.group.remove(o);if(o.geometry!==this.geometry)o.geometry?.dispose();if(o.material?.map?.userData?.temporary)o.material.map.dispose();o.material?.dispose();}}
  plane(x,y,w,h,material,z=0){material.side=THREE.DoubleSide;const mesh=new THREE.Mesh(this.geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,-h,1);this.group.add(mesh);return mesh;}
  rect(x,y,w,h,color,z=0,opacity=1){return this.plane(x,y,w,h,new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}),z);}
  circle(x,y,r,color,z=0,opacity=1){const m=new THREE.Mesh(new THREE.CircleGeometry(r,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));m.position.set(x,y,z);this.group.add(m);return m;}
  ring(x,y,r,color,z=0,opacity=1){const m=new THREE.Mesh(new THREE.RingGeometry(r-1.4,r+1.4,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));m.position.set(x,y,z);this.group.add(m);return m;}
  image(name,x,y,w,h,z=1,opacity=1){return this.plane(x,y,w,h,new THREE.MeshBasicMaterial({map:this.textures[name],transparent:true,opacity,depthWrite:false}),z);}
  bead(key,color,p,size,opacity=1){const mesh=this.image(COLORS[color].file,p.x,p.y,size,size,2,opacity);mesh.userData={x:p.x,y:p.y,size,opacity,color};this.beads.set(key,mesh);return mesh;}
  text(text,x,y,size=16,color='#796d55',align='center'){
    const c=document.createElement('canvas');c.width=Math.max(200,text.length*size*2.4);c.height=size*3;
    const ctx=c.getContext('2d');ctx.font=`${size*2}px "Microsoft YaHei", sans-serif`;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,c.height/2);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.userData.temporary=true;
    this.plane(x,y,c.width/2,c.height/2,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),4);
  }
  draw(state,level,selected,hint){
    this.designView=null;if(compact&&H!==910)this.resize();
    this.last=[state,level,selected,hint];this.clear();this.beads.clear();this.rims.clear();
    this.image('workbench',W/2,H/2,W,H,-5);
    this.text('料 杆 · 只 能 从 左 端 取 珠',compact?330:287,compact?82:90,17,'#5d6655');
    if(!compact){this.text('定 制 手 链',741,82,17,'#5d6655');this.rect(515,351,1,490,'#c7bba1',-1);}
    state.rails.forEach((rail,i)=>{
      const p=railPos(i);this.text('ABCD'[i],76,p.y,17,'#a08a58');
      this.rect(compact?325:294,p.y,compact?430:365,4,'#ad8d51',-1);this.circle(compact?540:467,p.y,5,'#b6995b',0);
      this.ring(p.x,p.y,34,'#b9a57d',0,.45);
      if(!rail.length)this.text('已取空',285,p.y,15,'#a39881');
      rail.forEach((c,j)=>{const q=railPos(i,j);this.bead(`rail-${i}-${j}`,c,q,83);});
      if(rail.length){this.text('‹',p.x-53,p.y,27,'#8e774c');if(selected?.type==='rail'&&selected.index===i)this.ring(p.x,p.y,40,'#365e4d',3);}
    });
    this.text('暂 存 盘',compact?330:237,compact?485:520,17,'#5d6655');
    state.buffer.forEach((c,i)=>{const p=bufferPos(i,level.capacity);this.circle(p.x+2,p.y+4,41,'#988465',-1,.13);this.circle(p.x,p.y,41,'#e5dcc8');this.rims.set(`buffer-${i}`,this.ring(p.x,p.y,39,'#b7a482'));this.ring(p.x,p.y,32,'#ccbea3',0,.5);if(c!==null)this.bead(`buffer-${i}`,c,p,83);else this.text('＋',p.x,p.y,24,'#b7a98d');if(selected?.type==='buffer'&&selected.index===i)this.ring(p.x,p.y,43,'#365e4d',3);});
    this.text(`${state.buffer.filter(c=>c!==null).length} / ${level.capacity} 格占用 · 用完即可腾空`,compact?330:240,compact?604:642,14,'#8a7e67');
    state.orders.forEach((done,i)=>{
      const p=orderPos(i), goal=level.orders[i];this.circle(p.x+2,p.y+4,105,'#988465',-1,.12);this.circle(p.x,p.y,106,'#f1ead9',0);this.ring(p.x,p.y,102,'#c7b692');this.rims.set(`order-${i}`,this.ring(p.x,p.y,BRACELET_RADIUS,'#b79657'));
      braceletLayout(goal).forEach(({slot,goalIndex:j,color,x,y,angle})=>{
        const q={x:p.x+x*BRACELET_RADIUS,y:p.y+y*BRACELET_RADIUS},base=j<0;
        const mesh=this.bead(base?`base-${i}-${slot}`:`order-${i}-${j}`,color,q,BRACELET_BEAD_SIZE,base||j<done.length?1:.24);mesh.userData.order=i;mesh.userData.slot=slot;
        if(!base){const a=angle+Math.PI/BRACELET_SITES,s=this.rect(p.x+Math.cos(a)*BRACELET_RADIUS,p.y+Math.sin(a)*BRACELET_RADIUS,3.5,12,'#baa06a',3);s.rotation.z=a;this.circle(s.position.x-1,s.position.y-2,1.2,'#fff3ca',4,.7);}
        if(j===done.length){this.ring(q.x,q.y,18,'#48725b',3);this.circle(q.x+13,q.y-13,3,'#48725b',4);}
      });
      this.circle(p.x,p.y+BRACELET_RADIUS+18,4,'#c2a76d',3);this.circle(p.x,p.y+BRACELET_RADIUS+25,5,'#e5d8b4',3);this.ring(p.x,p.y+BRACELET_RADIUS+25,5,'#b69b60',4);
      this.text(`配珠 ${i+1}`,p.x,p.y-12,17,'#6a634f');this.text(`${done.length} / ${goal.length}`,p.x,p.y+15,19,'#47634e');
      const next=goal[done.length];this.text(next===undefined?'已完成 ✓':`下一颗 · ${COLORS[next].name}${COLORS[next].symbol}`,p.x,p.y+136,16,next===undefined?'#3c7255':'#6d735d');
    });
    if(hint){const p=sourcePos(hint.source,level.capacity),q=hint.target.type==='order'?orderPos(hint.target.index):bufferPos(hint.target.index,level.capacity);this.ring(p.x,p.y,45,'#ba9146',4);this.ring(q.x,q.y,hint.target.type==='order'?112:45,'#ba9146',4);}
    this.frame(performance.now());
  }
  drawDesign(view){
    this.designView=view;this.last=null;if(compact&&H!==740)this.resize();this.clear();this.beads.clear();this.rims.clear();
    this.image('workbench',W/2,H/2,W,H,-5);
    const cy=compact?278:305,r=compact?177:190;
    this.circle(W/2+4,cy+9,r+74,'#b0c9e4',-3,.22);this.circle(W/2,cy,r+68,'#ffffff',-2);this.ring(W/2,cy,r+65,'#d9b66a',-1);
    this.ring(W/2,cy,r,'#c6a45c');
    for(let y=cy-r-35;y<cy+r+35;y+=18)this.rect(W/2,y,2,8,'#a9c8e8',0,.8);
    this.text('听 海 的 旧 约',W/2,cy-20,compact?24:27,'#275cad');
    this.text('左 右 对 称 · 随 你 搭 配',W/2,cy+22,15,'#6b8fb5');
    this.text('从 空 串 开 始 · 每 颗 珠 子 亲 手 串 起',W/2,35,14,'#416da5');
    const launcher=launcherPos();
    if(view.aim!==null&&view.aim!==undefined&&view.color!==null){for(let i=1;i<12;i++){const p=launchPoint(i/12,launcher,designPos(view.aim));this.circle(p.x,p.y,2.1,'#e3b951',1,.48);}}
    view.slots.forEach((color,i)=>{const p=designPos(i),size=designBeadSize();
      if(color!==null){this.circle(p.x+2,p.y+4,size*.43,'#b3ccea',0,.2);const m=this.bead(`design-${i}`,color,p,size);m.userData.designSlot=i;}else this.text('＋',p.x,p.y,18,'#a5bfd7');
      this.rims.set(`design-${i}`,this.ring(p.x,p.y,color===null?10:size*.43,view.aim===i?'#e6b940':'#d7e7f8',3,view.aim===i?.7:.18));
      if(view.selected===i)this.ring(p.x,p.y,size*.49,'#2587f5',4);
      const a=-Math.PI/2+i*Math.PI/6;
      this.text(String(i+1),p.x+Math.cos(a)*(size*.54),p.y+Math.sin(a)*(size*.54),12,'#7797b7');
    });
    this.circle(launcher.x,launcher.y+9,51,'#b2cce8',0,.35);this.circle(launcher.x,launcher.y,49,'#2877d6',1);this.ring(launcher.x,launcher.y,48,'#f3ca64',3);
    this.rect(launcher.x-49,launcher.y+5,7,46,'#dcb85e',3);this.rect(launcher.x+49,launcher.y+5,7,46,'#dcb85e',3);
    if(view.color!==null)this.bead('launcher',view.color,launcher,86);
    this.text(view.color===null?'取下模式':'点 此 弹 射',W/2,compact?699:687,15,'#2e65ad');
    this.frame(performance.now());
  }
  sourceKey(source){return source.type==='rail'?`rail-${source.index}-0`:`buffer-${source.index}`;}
  interruptSource(source){const key=this.sourceKey(source),e=this.effects.find(e=>e.type==='flight'&&e.key===key);if(!e)return null;const p={x:e.mesh.position.x,y:e.mesh.position.y};this.removeFx(e.mesh);this.removeFx(e.shadow);this.effects.splice(this.effects.indexOf(e),1);return p;}
  point(clientX,clientY){const r=this.host.getBoundingClientRect();return {x:(clientX-r.left)/r.width*W,y:(clientY-r.top)/r.height*H};}
  floating(color,point,size=83){const mesh=this.image(COLORS[color].file,point.x,point.y,size,size,12);this.fx.add(mesh);return mesh;}
  beginDrag(source,color,point,touch=false){
    this.releaseDrag();this.interruptSource(source);this.drag={key:this.sourceKey(source),source,color,point,contacts:new Set(),origin:sourcePos(source,this.last[1].capacity),touch,mesh:this.floating(color,point),shadow:this.circle(point.x,point.y,28,'#594b36',9,.16)};this.fx.add(this.drag.shadow);this.moveDrag(point);return true;
  }
  beginDesignDrag(index,color,point,touch=false){
    this.releaseDrag();this.cancelFlights([index]);const size=designBeadSize();
    this.drag={key:`design-${index}`,source:{type:'design',index},color,point,contacts:new Set(),origin:designPos(index),touch,size,mesh:this.floating(color,point,size),shadow:this.circle(point.x,point.y,30,'#594b36',9,.16)};
    this.fx.add(this.drag.shadow);this.moveDrag(point);return true;
  }
  moveDrag(point,target=null,valid=false){
    if(!this.drag)return;const d=this.drag;d.point={x:point.x,y:point.y-(d.touch?62:18)};
    d.mesh.position.set(d.point.x,d.point.y,12);d.mesh.scale.set(d.size??92,-(d.size??92),1);d.mesh.rotation.z=Math.max(-.25,Math.min(.25,(d.point.x-d.origin.x)*.0007));
    d.shadow.position.set(d.point.x+6,d.point.y+25,9);d.shadow.scale.set(1.15,.38,1);
    if(!this.reduced){
      const touching=new Set();
      for(const [key,m] of this.beads){if(key===d.key||m.userData.opacity<1||!m.visible)continue;
        const dx=m.position.x-d.point.x,dy=m.position.y-d.point.y,dist=Math.hypot(dx,dy),reach=(m.userData.size+92)*.3;
        if(dist<reach&&dist>1){touching.add(key);if(!d.contacts.has(key)){
          this.effects.push({type:'contact',key,dx:dx/dist*10,dy:dy/dist*10,start:performance.now(),duration:420});
          if(!d.contactTime||performance.now()-d.contactTime>110){d.contactTime=performance.now();this.onContact?.(m.userData.color,m.position.x);}
        }}
      }
      d.contacts=touching;
    }
    this.dragTarget=target?{...target,valid}:null;this.frame(performance.now());
  }
  removeFx(mesh){if(!mesh)return;this.fx.remove(mesh);if(mesh.geometry!==this.geometry)mesh.geometry.dispose();mesh.material.dispose();}
  releaseDrag(){
    if(!this.drag)return null;const d=this.drag;this.removeFx(d.mesh);this.removeFx(d.shadow);this.drag=null;this.dragTarget=null;return d;
  }
  cancelDrag(){const d=this.releaseDrag();if(!d)return;this.animate(d.color,d.point,d.origin,{key:d.key,returning:true,endSize:d.size});}
  cancelFlights(slots){for(const e of [...this.effects])if(slots.some(i=>e.key===`design-${i}`)){this.removeFx(e.mesh);this.removeFx(e.shadow);this.effects.splice(this.effects.indexOf(e),1);}}
  animate(color,from,to,{key,target,source,returning=false,onImpact,launch=false,endSize}={}){
    if(this.reduced){onImpact?.();this.render();return;}
    if(source?.type==='rail')for(const e of this.effects)if(e.source?.type==='rail'&&e.source.index===source.index)e.source=null;
    const mesh=this.floating(color,from),shadow=this.circle(from.x,from.y+18,25,'#594b36',8,.12);this.fx.add(shadow);
    this.effects.push({type:'flight',mesh,shadow,color,from,to,key,target,source,returning,onImpact,launch,endSize,start:performance.now(),duration:returning?180:launch?560:260,landed:false});
    if(launch)this.effects.push({type:'recoil',key:'launcher',start:performance.now(),duration:340});
    this.frame(performance.now());
  }
  reject(target){
    const p=target.type==='order'?orderPos(target.index):bufferPos(target.index,this.last[1].capacity),ring=this.ring(p.x,p.y,target.type==='order'?109:43,'#ac6446',7,.8);this.fx.add(ring);
    this.effects.push({type:'reject',mesh:ring,target,start:performance.now(),duration:360});this.frame(performance.now());
  }
  impact(effect,now){
    const ring=this.ring(effect.to.x,effect.to.y,22,'#c7a460',7,.7);this.fx.add(ring);
    this.effects.push({type:'impact',mesh:ring,key:effect.key,target:effect.target,start:now,duration:650});
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2,mesh=this.circle(effect.to.x,effect.to.y,1.5,'#c7a460',9,.75);this.fx.add(mesh);this.effects.push({type:'spark',mesh,origin:effect.to,dx:Math.cos(a)*28,dy:Math.sin(a)*20-9,start:now,duration:400});}
    effect.onImpact?.();
  }
  celebrate(index){if(this.reduced)return;const p=orderPos(index),mesh=this.ring(p.x,p.y,100,'#b7954a',7,.8);this.fx.add(mesh);this.effects.push({type:'thread',mesh,index,start:performance.now(),duration:650});}
  cancelFeedback(){cancelAnimationFrame(this.raf);this.releaseDrag();for(const e of this.effects??[]){this.removeFx(e.mesh);this.removeFx(e.shadow);}this.effects=[];}
  frame(now){
    cancelAnimationFrame(this.raf);
    for(const mesh of this.beads.values()){const b=mesh.userData;mesh.position.set(b.x,b.y,2);mesh.scale.set(b.size,-b.size,1);mesh.rotation.z=0;mesh.material.opacity=b.opacity;mesh.visible=true;}
    for(const rim of this.rims.values()){rim.scale.set(1,1,1);rim.material.color.set('#b79657');}
    const selected=this.last?.[2],key=selected?this.sourceKey(selected):null;
    const picked=this.beads.get(key);if(picked){picked.position.y-=10;picked.scale.multiplyScalar(1.07);picked.rotation.z=-.045;}
    if(this.drag){const original=this.beads.get(this.drag.key);if(original)original.visible=false;}
    if(this.dragTarget){const t=this.dragTarget,rim=this.rims.get(`${t.type}-${t.index}`);if(rim){rim.material.color.set(t.valid?'#46795c':'#ac6446');rim.scale.setScalar(1.035);}}
    for(const e of [...this.effects]){
      const age=now-e.start,t=Math.max(0,Math.min(1,age/e.duration));
      if(e.type==='flight'){
        const dest=this.beads.get(e.key);
        if(age<e.duration){
          if(dest)dest.visible=false;const p=e.launch?launchPoint(t,e.from,e.to):flightPoint(t,e.from,e.to,e.returning?12:35),size=83+((e.endSize??(e.target?.type==='order'?BRACELET_BEAD_SIZE:83))-83)*t;
          e.mesh.position.set(p.x,p.y,12);e.mesh.scale.set(size,-size,1);e.mesh.rotation.z=Math.sin(t*Math.PI)*(e.launch ? .8 : .19);
          e.shadow.position.set(p.x+3,p.y+14+Math.sin(t*Math.PI)*16,8);e.shadow.scale.set(.8,.25,1);e.shadow.material.opacity=.12*(1-.5*Math.sin(t*Math.PI));
          if(e.source?.type==='rail')for(let j=0;j<5;j++){const m=this.beads.get(`rail-${e.source.index}-${j}`);if(m){m.position.x+=(compact?93:81)*(1-t)**3;m.rotation.z=rebound(age/1000, .12);}}
        }else if(!e.landed){e.landed=true;if(e.returning)e.onImpact?.();else this.impact(e,now);}
      }else if(e.type==='impact'){
        const spring=rebound(age/1000),m=this.beads.get(e.key);if(m){m.position.y+=spring*7;m.scale.x*=1+spring*.09;m.scale.y*=1-spring*.07;m.rotation.z=spring*.12;}
        const rim=this.rims.get(`${e.target?.type}-${e.target?.index}`);if(rim)rim.scale.setScalar(1+spring*.018);
        if(e.target?.type==='order'&&m)for(const neighbor of this.beads.values()){const d=neighbor.userData,delta=(d.slot-m.userData.slot+BRACELET_SITES)%BRACELET_SITES;if(d.order===e.target.index&&(delta===1||delta===BRACELET_SITES-1)&&d.opacity===1){const wave=rebound(age/1000-.035,.65);neighbor.rotation.z=wave*.16;neighbor.position.y+=wave*4;}}
        if(e.target?.type==='design'&&m)for(const neighbor of this.beads.values()){const delta=(neighbor.userData.designSlot-e.target.index+12)%12;if(delta===1||delta===11){const wave=rebound(age/1000-.035,.65);neighbor.rotation.z=wave*.12;neighbor.position.y+=wave*4;}}
        e.mesh.scale.setScalar(1+t*1.8);e.mesh.material.opacity=.6*(1-t)**2;
      }else if(e.type==='recoil'){
        const m=this.beads.get('launcher');if(m){const spring=Math.sin(t*Math.PI)*Math.exp(-t*3);m.position.y+=spring*18;m.scale.x*=1+spring*.2;m.scale.y*=1-spring*.18;}
      }else if(e.type==='contact'){
        const m=this.beads.get(e.key),s=rebound(age/1000+.02);if(m){m.position.x+=s*e.dx;m.position.y+=s*e.dy;m.rotation.z+=s*.14;}
      }else if(e.type==='thread'){
        e.mesh.scale.setScalar(1+t*.11);e.mesh.material.opacity=.75*(1-t);
        for(const m of this.beads.values())if(m.userData.order===e.index){const wave=rebound(age/1000);m.scale.multiplyScalar(1+wave*.055);m.rotation.z+=wave*.06;}
      }else if(e.type==='spark'){e.mesh.position.x=e.origin.x+e.dx*t;e.mesh.position.y=e.origin.y+e.dy*t;e.mesh.material.opacity=.75*(1-t)**2;
      }else if(e.type==='reject'){e.mesh.material.opacity=.8*(1-t);e.mesh.position.x+=Math.sin(age*.07)*(1-t)*.8;}
      if(age>=e.duration){this.removeFx(e.mesh);this.removeFx(e.shadow);this.effects.splice(this.effects.indexOf(e),1);}
    }
    this.render();if(this.effects.length)this.raf=requestAnimationFrame(t=>this.frame(t));
  }
  status(){return {dragging:!!this.drag,flights:this.effects.filter(e=>e.type==='flight').length,impacts:this.effects.filter(e=>e.type==='impact').length};
  }
  render(){this.renderer.render(this.scene,this.camera);}
}
