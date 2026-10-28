export function flightPoint(t,from,to,arc=32){
  t=Math.max(0,Math.min(1,t));const e=t*t*(3-2*t);
  return {x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e-Math.sin(Math.PI*t)*arc};
}
export function rebound(seconds,amplitude=1){
  return seconds<0||seconds>.65?0:Math.sin(seconds*34)*Math.exp(-seconds*9)*amplitude;
}
export function launchPoint(t,from,to,arc=120){
 t=1-(1-Math.max(0,Math.min(1,t)))**1.3;
 return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t-4*arc*t*(1-t)};
}
