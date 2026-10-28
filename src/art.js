const painted=new Set(['workbench','well','roses','coral','jade','amber','pearl','blue','lilac','garnet','turquoise','smoky','citrine','blue-moon','strawberry','ice-quartz','malachite','tiger-eye','obsidian','shell','sandalwood','carnelian']);
const portraits=new Set(['customer-lin','customer-zhou','customer-grandma']);
export function art(name){
 const base=import.meta.env.BASE_URL;
 return `${base}art/${portraits.has(name)?`pink/${name}.webp`:painted.has(name)?`pink/${name}.svg`:`${name}.svg`}`;
}
