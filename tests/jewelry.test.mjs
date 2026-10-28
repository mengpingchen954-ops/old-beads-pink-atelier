import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {levels} from '../src/levels.js';
import {braceletLayout,BRACELET_RADIUS,BRACELET_BEAD_SIZE} from '../src/jewelry.js';
import {crystalData,crystalProfiles} from '../scripts/crystal-art.mjs';
import fs from 'node:fs';
import {COLORS} from '../src/materials.js';

test('every commission has a closed strand and exactly one visible site per playable bead',()=>{
 for(const level of levels)for(const order of level.orders){
  const layout=braceletLayout(order),accents=layout.filter(p=>p.goalIndex>=0);
  assert.equal(layout.length,18);assert.deepEqual(accents.map(p=>p.color),order);
  assert.deepEqual(accents.map(p=>p.goalIndex),order.map((_,i)=>i));
  for(let i=0;i<layout.length;i++){
   const a=layout[i],b=layout[(i+1)%layout.length],gap=Math.hypot(a.x-b.x,a.y-b.y)*BRACELET_RADIUS;
   assert.ok(gap<BRACELET_BEAD_SIZE*206/256,'rendered bead bodies must touch around the entire loop');
  }
 }
});

test('nineteen original crystal textures decode as complete transparent PNG sprites',()=>{
 const images=crystalProfiles.map(p=>crystalData(p.name));assert.equal(new Set(images).size,19);
 for(const data of images){
  const png=Buffer.from(data.split(',')[1],'base64');assert.equal(png.subarray(1,4).toString(),'PNG');
  assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);
  const parts=[];for(let offset=8;offset<png.length;){const size=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')parts.push(png.subarray(offset+8,offset+8+size));offset+=size+12;}
  const pixels=inflateSync(Buffer.concat(parts));assert.equal(pixels.length,256*1025);
  assert.equal(pixels[4],0);assert.ok(pixels[121*1025+1+125*4+3]>=235);
 }
});
test('all 24 material assets exist and original shape charms have distinct silhouettes',()=>{
 assert.equal(COLORS.length,24);assert.equal(new Set(COLORS.map(c=>c.file)).size,24);
 for(const c of COLORS){const svg=fs.readFileSync(new URL(`../public/art/${c.file}.svg`,import.meta.url),'utf8');assert.match(svg,/<svg/);assert.match(svg,/256/);}
 const shapes=COLORS.slice(19).map(c=>fs.readFileSync(new URL(`../public/art/${c.file}.svg`,import.meta.url),'utf8'));assert.equal(new Set(shapes).size,5);assert.ok(shapes.every(s=>!s.includes('base64')));
});
