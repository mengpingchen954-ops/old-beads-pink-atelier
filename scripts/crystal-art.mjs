import {deflateSync} from 'node:zlib';

// Original, deterministic sphere shading. No reference photographs are embedded.
export const crystalProfiles=[
 {name:'coral',absorb:[.02,.14,.12],tint:[248,135,163],cloud:[255,190,202],rough:.28,kind:'rose'},
 {name:'jade',absorb:[.12,.045,.10],tint:[93,188,149],cloud:[123,202,173],rough:.20,kind:'moss'},
 {name:'amber',absorb:[.01,.06,.22],tint:[239,181,55],cloud:[246,203,108],rough:.08,kind:'rutile'},
 {name:'pearl',absorb:[.015,.015,.015],tint:[205,226,244],cloud:[240,244,248],rough:.28,kind:'moon'},
 {name:'blue',absorb:[.15,.045,.012],tint:[80,177,227],cloud:[141,214,241],rough:.10,kind:'aqua'},
 {name:'lilac',absorb:[.07,.20,.025],tint:[173,100,214],cloud:[202,151,226],rough:.11,kind:'amethyst'},
 {name:'garnet',absorb:[.22,.035,.06],tint:[217,70,92],cloud:[246,133,145],rough:.16,kind:'garnet'},
 {name:'turquoise',absorb:[.015,.10,.085],tint:[39,188,177],cloud:[114,224,204],rough:.13,kind:'turquoise'},
 {name:'smoky',absorb:[.08,.07,.02],tint:[112,128,176],cloud:[177,190,221],rough:.24,kind:'smoky'},
 {name:'citrine',absorb:[.01,.08,.18],tint:[242,137,46],cloud:[255,197,103],rough:.09,kind:'citrine'},
 {name:'blue-moon',absorb:[.05,.03,.005],tint:[129,182,245],cloud:[220,237,255],rough:.12,kind:'moon'},
 {name:'strawberry',absorb:[.01,.1,.07],tint:[242,135,164],cloud:[244,185,200],rough:.2,kind:'strawberry'},
 {name:'ice-quartz',absorb:[.03,.015,.005],tint:[207,233,250],cloud:[255,255,255],rough:.08,kind:'ice'},
 {name:'malachite',absorb:[.14,.01,.11],tint:[28,151,98],cloud:[120,222,151],rough:.3,kind:'malachite'},
 {name:'tiger-eye',absorb:[.01,.08,.19],tint:[193,133,38],cloud:[255,214,103],rough:.15,kind:'tiger'},
 {name:'obsidian',absorb:[.2,.2,.12],tint:[36,33,64],cloud:[118,104,167],rough:.08,kind:'obsidian'},
 {name:'shell',absorb:[.005,.02,.04],tint:[252,231,190],cloud:[255,247,232],rough:.2,kind:'shell'},
 {name:'sandalwood',absorb:[.02,.09,.16],tint:[155,83,34],cloud:[221,157,90],rough:.3,kind:'wood'},
 {name:'carnelian',absorb:[.005,.12,.2],tint:[248,122,56],cloud:[255,190,111],rough:.16,kind:'carnelian'}
];
function crc(data){let c=0xffffffff;for(const byte of data){c^=byte;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([name,data])),8+data.length);return out;}
function png(pixels,size){const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;const rows=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++)pixels.copy(rows,y*(size*4+1)+1,y*size*4,(y+1)*size*4);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a*(1-t)+b*t;
const hash=(x,y,z)=>{const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return n-Math.floor(n);};
function noise(x,y,z){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),smooth=t=>t*t*(3-2*t),u=smooth(x-ix),v=smooth(y-iy),w=smooth(z-iz);
 const layer=k=>mix(mix(hash(ix,iy,k),hash(ix+1,iy,k),u),mix(hash(ix,iy+1,k),hash(ix+1,iy+1,k),u),v);
 return mix(layer(iz),layer(iz+1),w);
}
const cloudNoise=(x,y,z)=>noise(x*3,y*3,z*3)*.55+noise(x*9,y*9,z*9)*.28+noise(x*27,y*27,z*27)*.12+noise(x*75,y*75,z*75)*.05;
const cache=new Map();
export function crystalData(name){
 if(cache.has(name))return cache.get(name);
 const profile=crystalProfiles.find(p=>p.name===name),size=256,radius=103,pixels=Buffer.alloc(size*size*4);
 const fibers=Array.from({length:profile.kind==='rutile'?32:16},(_,i)=>{
   const a=hash(i,8,2)*6.28,b=profile.kind==='rutile'?a+1.7+hash(i,9,2)*1.4:hash(i,9,2)*6.28;
   return {ax:Math.cos(a)*.88,ay:Math.sin(a)*.88,bx:Math.cos(b)*.92,by:Math.sin(b)*.92};
 });
 for(let py=0;py<size;py++)for(let px=0;px<size;px++){
   const x=(px-125)/radius,y=(py-121)/radius,rr=x*x+y*y,offset=(py*size+px)*4;
   let rgb=[62,49,33],alpha=.22*Math.exp(-(((px-132)/105)**2+((py-136)/101)**2)*3.6);
   if(rr<1){
     const z=Math.sqrt(1-rr),n=cloudNoise(x,y,z),light=clamp(-.47*x-.57*y+.68*z),fresnel=(1-z)**2;
     rgb=profile.absorb.map((a,i)=>[250,248,240][i]*Math.exp(-a*(.28+.82*z))*(.86+.19*light)+10*z);
     rgb=rgb.map((v,i)=>mix(v,profile.tint[i],.48+.08*(1-z)));
     const lowerShade=clamp((y+.08)*.34+(1-z)*.16);
     rgb=rgb.map((v,i)=>mix(v,profile.tint[i]*.62,lowerShade*.22));
     let cloud=clamp((n-.42)*1.45)*profile.rough;
     if(profile.kind==='moss')cloud=clamp((cloudNoise(x*1.4,y*1.3,z)-.48)*4.2)*.38;
     if(profile.kind==='amethyst')cloud=clamp((cloudNoise(x*1.5,y,z)-.38)*1.2)*.22;
     rgb=rgb.map((v,i)=>mix(v,profile.cloud[i],cloud));
     if(profile.kind==='malachite'){
       const band=(Math.sin(Math.hypot(x+.5,y-.1)*43+n*5)+1)/2;
       rgb=profile.tint.map((v,i)=>mix(v,[143,231,164][i],band*.58)*(.76+.24*light));
     }
     if(profile.kind==='tiger'){
       const band=(Math.sin(x*42+Math.sin(y*4)*3)+1)/2,eye=Math.exp(-((x+y*.25-.03)**2)/.016);
       rgb=[104,59,20].map((v,i)=>mix(mix(v,profile.tint[i],band*.48),[255,223,112][i],eye*.92));
     }
     if(profile.kind==='wood'){
       const grain=(Math.sin(y*76+Math.sin(x*7)*2+n*8)+1)/2;
       rgb=profile.tint.map((v,i)=>mix(v*.56,profile.cloud[i],grain*.48)*(.7+.3*light));
     }
     if(profile.kind==='obsidian')rgb=profile.tint.map((v,i)=>v*(.7+.8*light)+profile.cloud[i]*Math.exp(-((x-.24)**2/.05+(y-.1)**2/.25))*.32);
     if(profile.kind==='strawberry'){
       const fleck=hash(Math.floor(x*64),Math.floor(y*64),7)>.969&&z>.2;
       if(fleck)rgb=rgb.map((v,i)=>mix(v,[180,46,83][i],.58));
     }
     if(profile.kind==='shell'){
       const nacre=(Math.sin((x+y*.4)*28+n*4)+1)/2;
       rgb=rgb.map((v,i)=>mix(v,[255,224,218][i],nacre*.3));
     }
     // Internal fractures catch light behind the surface, rather than forming painted outlines.
     let lines=0;
     for(const f of fibers){
       const dx=f.bx-f.ax,dy=f.by-f.ay,t=clamp(((x-f.ax)*dx+(y-f.ay)*dy)/(dx*dx+dy*dy));
       const bend=profile.kind==='rutile'?0:(n-.5)*.055;
       const distance=Math.hypot(x-f.ax-dx*t,y-f.ay-dy*t+bend);
       lines+=Math.exp(-((distance/.004)**2))*(.22+n*.4)*clamp(z*3);
     }
     const fracture=profile.kind==='ice'?1.5:['wood','malachite','tiger','obsidian'].includes(profile.kind)?0:profile.kind==='moon'?.15:.65;
     rgb=rgb.map((v,i)=>mix(v,profile.kind==='rutile'?[158,113,41][i]:[252,251,244][i],clamp(clamp(lines)*fracture)));
     if(profile.kind==='moon'){
     const blueGlow=Math.exp(-((x-.24)**2/.14+(y+.06)**2/.3))*.32;
       rgb=rgb.map((v,i)=>mix(v,[112,178,245][i],blueGlow));
     }
     const cord=Math.exp(-(((y-.09-.035*Math.sin(x*3))/.009)**2))*clamp((.85-Math.abs(x))*8)*.16;
     rgb=rgb.map(v=>mix(v,255,cord));
     const innerGlow=Math.exp(-((x+.12)**2/.48+(y+.25)**2/.62))*.08;
     rgb=rgb.map(v=>mix(v,255,innerGlow));
     const reflection=clamp((-.31*x-.41*y+.857*z));
     const spec=Math.pow(reflection,180)*.98+Math.pow(reflection,30)*.2;
     const window=Math.exp(-(((x+.41)/.12)**8+((y+.46)/.065)**8))*.95;
     const broadHighlight=Math.exp(-(((x+.30)/.23)**2+((y+.34)/.18)**2))*0.42;
     const rimGlow=Math.exp(-(((Math.sqrt(rr)-.88)/.045)**2))*.2;
     const lower=Math.exp(-(((Math.sqrt(rr)-.85)/.028)**2))*clamp(y+.3)*clamp(x+.55)*.55;
     rgb=rgb.map((v,i)=>mix(mix(mix(v,[220,239,250][i],fresnel*.25),profile.tint[i]*.72,rimGlow),[255,255,252][i],clamp(spec+window+lower+broadHighlight)));
     // Tiny side openings preserve the real through-drilled appearance.
     const hole=Math.exp(-(((Math.abs(x)-.942)/.027)**2+((y-.09)/.024)**2))*.65;
     rgb=rgb.map(v=>mix(v,104,hole*.28));alpha=clamp((1-rr)*18)*(.9+.08*z);
   }
   for(let c=0;c<3;c++)pixels[offset+c]=clamp(rgb[c]/255)*255;
   pixels[offset+3]=alpha*255;
 }
 const data=`data:image/png;base64,${png(pixels,size).toString('base64')}`;cache.set(name,data);return data;
}
export const crystalBody=name=>`<image width="256" height="256" href="${crystalData(name)}"/>`;
