// Original procedural foley: short contact transients plus damped material resonances.
export const MATERIALS = [
  {hz:1420,decay:.085,partials:[1,1.63,2.71],noise:.23},
  {hz:2190,decay:.16,partials:[1,1.49,2.26],noise:.08},
  {hz:830,decay:.075,partials:[1,2.07,3.12],noise:.32},
  {hz:2670,decay:.12,partials:[1,1.91,2.73],noise:.06},
  {hz:1860,decay:.19,partials:[1,1.42,2.57],noise:.09},
  {hz:1250,decay:.11,partials:[1,1.78,2.93],noise:.17},
  {hz:980,decay:.095,partials:[1,1.31,2.43],noise:.2},
  {hz:1540,decay:.14,partials:[1,1.67,2.84],noise:.12},
  {hz:1120,decay:.22,partials:[1,1.38,2.18],noise:.06},
  {hz:2010,decay:.08,partials:[1,1.57,2.76],noise:.18},
  {hz:2380,decay:.17,partials:[1,1.52,2.61],noise:.06},
  {hz:1380,decay:.10,partials:[1,1.72,2.48],noise:.19},
  {hz:2920,decay:.21,partials:[1,1.36,2.74],noise:.04},
  {hz:1060,decay:.09,partials:[1,1.83,2.32],noise:.22},
  {hz:910,decay:.08,partials:[1,1.61,3.08],noise:.27},
  {hz:1680,decay:.13,partials:[1,1.41,2.62],noise:.10},
  {hz:1820,decay:.07,partials:[1,1.91,2.38],noise:.15},
  {hz:460,decay:.055,partials:[1,2.13,3.27],noise:.34},
  {hz:1230,decay:.085,partials:[1,1.58,2.94],noise:.18},
  {hz:2540,decay:.23,partials:[1,1.34,2.71],noise:.04},
  {hz:2030,decay:.18,partials:[1,1.56,2.41],noise:.07},
  {hz:3150,decay:.27,partials:[1,1.43,2.08],noise:.03},
  {hz:2240,decay:.14,partials:[1,1.74,2.67],noise:.1},
  {hz:2780,decay:.20,partials:[1,1.46,2.35],noise:.05}
];
function partial(ctx,out,hz,time,duration,gain,type='sine'){
  const osc=ctx.createOscillator(),env=ctx.createGain();osc.type=type;
  osc.frequency.setValueAtTime(hz,time);osc.frequency.exponentialRampToValueAtTime(hz*.985,time+duration);
  env.gain.setValueAtTime(0,time);env.gain.linearRampToValueAtTime(gain,time+.002);
  env.gain.exponentialRampToValueAtTime(.00001,time+duration);
  osc.connect(env);env.connect(out);osc.start(time);osc.stop(time+duration+.01);
  osc.onended=()=>{osc.disconnect();env.disconnect();};
}
function brush(ctx,out,time,amount,duration=.035){
  const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
  let seed=173;for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=(seed/1073741823.5-1)*(1-i/data.length)**3;}
  const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  src.buffer=buffer;filter.type='bandpass';filter.frequency.value=1800;filter.Q.value=.65;gain.gain.value=amount;
  src.connect(filter);filter.connect(gain);gain.connect(out);src.start(time);
  src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};
}
export function synthesize(ctx,out,event,{color=0,target='order',pan=0,strength=1,variation=0}={},time=ctx.currentTime){
  const m=MATERIALS[color]||MATERIALS[0],bus=ctx.createGain(),panner=ctx.createStereoPanner?.();
  bus.gain.value=strength;if(panner){panner.pan.value=Math.max(-.65,Math.min(.65,pan));bus.connect(panner);panner.connect(out);}else bus.connect(out);
  const pitch=1+Math.sin(variation*2.399)*.035;
  const contact=(at,energy=1,wood=false)=>{
    m.partials.forEach((ratio,i)=>partial(ctx,bus,(wood?510:m.hz)*ratio*pitch,at,(wood ? .07 : m.decay)/(1+i*.6),.105*energy/(1+i*2.3)));
    brush(ctx,bus,at,(wood ? .24 : m.noise)*energy*.25);
  };
  if(event==='pick'){brush(ctx,bus,time,.055,.045);partial(ctx,bus,m.hz*.7*pitch,time,.065,.035);}
  if(event==='launch'){
    const osc=ctx.createOscillator(),env=ctx.createGain();osc.type='triangle';osc.frequency.setValueAtTime(180,time);osc.frequency.exponentialRampToValueAtTime(720,time+.12);
    env.gain.setValueAtTime(.055,time);env.gain.exponentialRampToValueAtTime(.00001,time+.14);osc.connect(env);env.connect(bus);osc.start(time);osc.stop(time+.15);
    osc.onended=()=>{osc.disconnect();env.disconnect();};brush(ctx,bus,time,.08,.09);
  }
  if(event==='land'){
    contact(time,1,target==='buffer');contact(time+.038,.32,target==='buffer');
    if(target==='order')contact(time+.078,.14);
  }
  if(event==='reject'){contact(time,.4,true);partial(ctx,bus,170,time,.1,.045);}
  if(event==='undo'){brush(ctx,bus,time,.04,.07);partial(ctx,bus,580,time,.11,.025);}
  if(event==='thread'||event==='win'){
    const notes=event==='win'?[523.25,659.25,783.99,1046.5]:[659.25,783.99,987.77];
    notes.forEach((hz,i)=>{partial(ctx,bus,hz,time+i*.105,.8,.052);partial(ctx,bus,hz*2.002,time+i*.105,.35,.012);});
    brush(ctx,bus,time,.035,.15);
  }
  if(event==='coin'){
    [783.99,1046.5,1318.51].forEach((hz,i)=>{partial(ctx,bus,hz,time+i*.075,.38,.07,'triangle');partial(ctx,bus,hz*2,time+i*.075,.18,.018);});
    brush(ctx,bus,time+.16,.045,.09);
  }
  // Disconnect the event bus after all tails; no wall timers are needed for offline rendering.
  const end=ctx.createOscillator(),silent=ctx.createGain();silent.gain.value=0;end.connect(silent);silent.connect(out);end.start(time);end.stop(time+1.6);
  end.onended=()=>{end.disconnect();silent.disconnect();bus.disconnect();panner?.disconnect();};
}
export class AtelierAudio {
  constructor(prefs){this.prefs=prefs;this.active=false;this.sequence=0;this.step=0;}
  unlock(){
    if(document.hidden)return;
    if(!this.ctx){
      try{
        this.ctx=new(window.AudioContext||window.webkitAudioContext)();
        this.master=this.ctx.createGain();this.compressor=this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value=-16;this.compressor.knee.value=12;this.compressor.ratio.value=4;
        this.master.connect(this.compressor);this.compressor.connect(this.ctx.destination);this.apply();
      }catch{return;}
    }
    if(this.ctx.state==='suspended'||this.ctx.state==='interrupted')this.ctx.resume().then(()=>this.syncMusic()).catch(()=>{});
    this.syncMusic();
  }
  apply(){
    if(this.ctx)this.master.gain.setTargetAtTime(this.prefs.sound?this.prefs.volume??.7:0,this.ctx.currentTime,.025);
    this.syncMusic();
  }
  play(event,options={}){
    if(document.hidden)return;
    this.unlock();if(!this.ctx||!this.prefs.sound||document.hidden)return;
    synthesize(this.ctx,this.master,event,{...options,variation:this.sequence++});
  }
  setActive(active){this.active=active;this.syncMusic();}
  syncMusic(){
    clearTimeout(this.timer);this.timer=null;
    if(!this.ctx||this.ctx.state!=='running'||!this.active||!this.prefs.sound||this.prefs.music===false||document.hidden){this.musicBus?.gain.setTargetAtTime(0,this.ctx.currentTime,.08);return;}
    if(!this.musicBus){this.musicBus=this.ctx.createGain();this.musicBus.connect(this.master);}
    this.musicBus.gain.setTargetAtTime(1,this.ctx.currentTime,.15);
    if(!this.nextNote||this.nextNote<this.ctx.currentTime)this.nextNote=this.ctx.currentTime+.08;
    const schedule=()=>{
      if(this.nextNote<this.ctx.currentTime+.3){
        const notes=[261.63,329.63,392,493.88,440,392,329.63,293.66],hz=notes[this.step++%notes.length];
        partial(this.ctx,this.musicBus,hz,this.nextNote,2.5,.012);partial(this.ctx,this.musicBus,hz*2,this.nextNote,1.2,.0025);
        this.nextNote+=2.4;
      }
      this.timer=setTimeout(schedule,180);
    };
    schedule();
  }
  suspend(){clearTimeout(this.timer);this.timer=null;this.nextNote=0;this.ctx?.suspend().catch(()=>{});}
  status(){return {state:this.ctx?.state??'locked',enabled:this.prefs.sound,music:this.prefs.music!==false,volume:this.prefs.volume??.7,events:this.sequence};}
}
