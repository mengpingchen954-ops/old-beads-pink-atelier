export const BRACELET_SITES=18,BRACELET_RADIUS=80,BRACELET_BEAD_SIZE=36;
export const accentSlot=(index,count)=>Math.floor(index*BRACELET_SITES/count);
export function braceletLayout(order){
  return Array.from({length:BRACELET_SITES},(_,slot)=>{
    const goalIndex=order.findIndex((_,j)=>accentSlot(j,order.length)===slot),angle=-Math.PI/2+slot/BRACELET_SITES*Math.PI*2;
    return {slot,goalIndex,color:goalIndex<0?3:order[goalIndex],angle,x:Math.cos(angle),y:Math.sin(angle)};
  });
}
