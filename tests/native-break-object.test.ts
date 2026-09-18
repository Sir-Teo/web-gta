import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {readBreakable,type BreakableInfo} from '../src/assets/breakable';
import {readDff} from '../src/assets/dff';
import {NativeBreakManager,NativeBreakObject,BREAK_GROUP_TYPE,rwMatrix,type BreakInit} from '../src/simulation/nativeBreakObject';

/** Serialise a BreakInfo_t section as BreakableStreamWrite does. */
function writeBreakable(info:BreakableInfo){
 const v=info.positions.length/3,t=info.triangles.length/3,m=info.textures.length;
 const size=4+0x34+v*12+v*8+v*4+t*6+t*2+m*64+m*12,out=new DataView(new ArrayBuffer(size));let o=0;
 out.setUint32(o,1,true);o+=4;
 out.setUint32(o,info.positionRule,true);out.setUint16(o+4,v,true);out.setUint16(o+20,t,true);out.setUint16(o+32,m,true);o+=0x34;
 for(const f of info.positions){out.setFloat32(o,f,true);o+=4;}
 for(const f of info.uvs){out.setFloat32(o,f,true);o+=4;}
 for(const b of info.colors){out.setUint8(o,b);o++;}
 for(const i of info.triangles){out.setUint16(o,i,true);o+=2;}
 for(const i of info.materialIds){out.setUint16(o,i,true);o+=2;}
 for(const names of [info.textures,info.masks])for(const n of names){[...n].forEach((c,i)=>out.setUint8(o+i,c.charCodeAt(0)));o+=32;}
 for(const f of info.materialColors){out.setFloat32(o,f,true);o+=4;}
 return new Uint8Array(out.buffer);
}
/** Two materials: a flat 2x2 quad in the XY plane (material 0) and a 1x1 wall in the XZ plane (material 1). */
const INFO:BreakableInfo={
 positionRule:1,
 positions:new Float32Array([0,0,0, 2,0,0, 2,2,0, 0,2,0, 5,0,0, 6,0,0, 6,0,1]),
 uvs:new Float32Array(14),
 colors:new Uint8Array([100,100,100,255, 250,250,250,255, 100,100,100,255, 100,100,100,255, 10,20,30,255, 10,20,30,255, 10,20,30,255]),
 triangles:new Uint16Array([0,1,2, 0,2,3, 4,5,6]),
 materialIds:new Uint16Array([0,0,1]),
 textures:['lampost_16clr','metal'],masks:['',''],
 materialColors:new Float32Array([1,1,1, .5,.5,.5]),
};
const identity=rwMatrix([1,0,0],[0,1,0],[0,0,1],[100,200,10]);
/** A fixed sequence so every random draw is 0.5: ranges return their midpoints. */
const init=(extra:Partial<BreakInit>={}):BreakInit=>({info:INFO,ltm:identity,velocity:[0,0,.1],velocityRandom:0,justFaces:false,sparks:false,bounds:{min:[0,0,0],max:[6,2,1]},ambient:[32,32,32],ground:()=>({z:9,normal:[0,0,1]}),random:()=>.5,...extra});

describe('BreakableStreamRead',()=>{
 it('reads the counts, arrays and names written after BreakInfo_t',()=>{
  const read=readBreakable(writeBreakable(INFO))!;
  expect(read.positionRule).toBe(1);
  expect([...read.positions]).toEqual([...INFO.positions]);
  expect([...read.triangles]).toEqual([...INFO.triangles]);
  expect([...read.materialIds]).toEqual([0,0,1]);
  expect(read.textures).toEqual(['lampost_16clr','metal']);
  expect([...read.materialColors]).toEqual([1,1,1,.5,.5,.5]);
 });
 it('treats a zero section header as no breakable data',()=>{
  expect(readBreakable(new Uint8Array(4))).toBeUndefined();
 });
 const img=process.env.GTA_CONTENT_DIR&&`${process.env.GTA_CONTENT_DIR}/gta3.img`;
 it.skipIf(!img||!existsSync(img))('reads lamppost3 from the retail archive',()=>{
  const bytes=readFileSync(img!),n=bytes.readUInt32LE(4);
  for(let i=0;i<n;i++){
   const o=8+i*32;if(bytes.subarray(o+8,o+32).toString('latin1').replace(/\0.*$/,'').toLowerCase()!=='lamppost3.dff')continue;
   const off=bytes.readUInt32LE(o)*2048,size=bytes.readUInt16LE(o+4)*2048;
   const info=readDff(new Uint8Array(bytes.subarray(off,off+size))).geometries[0].breakable!;
   expect({rule:info.positionRule,vertices:info.positions.length/3,triangles:info.triangles.length/3,materials:info.textures.length}).toEqual({rule:1,vertices:76,triangles:46,materials:3});
   return;
  }
  throw new Error('lamppost3.dff not found');
 });
});

describe('BreakObject_c',()=>{
 it('groups triangles by material, or one per face when smashed hard',()=>{
  const byMaterial=new NativeBreakObject();byMaterial.init(init());
  expect(byMaterial.groups.map(g=>g.triangles.length)).toEqual([2,1]);
  expect(byMaterial.groups.map(g=>g.texture)).toEqual(['lampost_16clr','metal']);
  const faces=new NativeBreakObject();faces.init(init({justFaces:true}));
  expect(faces.groups.map(g=>g.triangles.length)).toEqual([1,1,1]);
 });
 it('prelights vertex colours with the material colour plus the frame ambient, clamped to 255',()=>{
  const o=new NativeBreakObject();o.init(init());
  expect([...o.groups[0].triangles[0].colors]).toEqual([132,132,132,255,255,255,132,132,132]);
  expect([...o.groups[1].triangles[0].colors.slice(0,3)]).toEqual([37,42,47]);
 });
 it('centres each group and classifies it by its thinnest axis',()=>{
  const o=new NativeBreakObject();o.init(init());
  const [flat,wall]=o.groups;
  // The quad centre (1,1,0) moves the group matrix; its thinnest axis is Z (AT).
  expect([...flat.matrix.slice(9)]).toEqual([101,201,10]);expect(flat.type).toBe(BREAK_GROUP_TYPE.at);expect(flat.boundingSize).toBe(0);
  expect([...flat.triangles[0].positions.slice(0,3)]).toEqual([-1,-1,0]);
  // The wall is thinnest along Y (UP).
  expect(wall.type).toBe(BREAK_GROUP_TYPE.up);expect([...wall.matrix.slice(9)]).toEqual([105.5,200,10.5]);
 });
 it('draws spin, velocity spread and lifetime from the native ranges',()=>{
  const o=new NativeBreakObject();o.init(init({velocityRandom:.07}));
  const g=o.groups[0];
  // Midpoint draws: spread 0, rotation speed 4.5 degrees per frame, lifetime 256 + trunc(0.5 x 31).
  expect(g.velocity).toEqual([0,0,.1]);expect(g.rotationSpeed).toBe(4.5);expect(g.framesToLive).toBe(271);
 });
 it('finds the ground below the collision-box centre',()=>{
  const seen:number[][]=[];const o=new NativeBreakObject();
  o.init(init({ground:origin=>{seen.push(origin);return {z:9,normal:[0,0,0]};}}));
  expect(seen).toEqual([[103,201,10.75]]);expect(o.groundZ).toBe(9);expect(o.normal).toEqual([0,0,1]);
 });
 it('falls under gravity and bounces off the ground with a puff of smoke',()=>{
  const o=new NativeBreakObject(),smoke:number[][]=[];o.init(init({velocity:[0,0,0]}));
  const g=o.groups[0];
  o.update(1);expect(g.velocity[2]).toBeCloseTo(-1/125,9);expect(g.matrix[11]).toBeCloseTo(10-1/125,9);
  const fx={smoke:(p:number[])=>smoke.push(p),sparks:()=>{}};
  for(let i=0;i<60&&!smoke.length;i++)o.update(1,fx);
  expect(smoke).toHaveLength(4);
  // Landed: sitting on the ground at its bounding size, with the reflected speed scaled by 0.8 and no spin.
  expect(g.matrix[11]).toBe(9);expect(g.rotationSpeed).toBe(0);expect(g.velocity[2]).toBeGreaterThan(0);
 });
 it('stops a slow piece and fades every group out',()=>{
  const o=new NativeBreakObject();o.init(init({velocity:[0,0,0]}));
  expect(o.alpha(o.groups[0])).toBe(255);
  let frames=0;while(o.update(1)&&frames<1000)frames++;
  expect(o.active).toBe(false);expect(frames).toBe(270);
  expect(o.groups.every(g=>g.stoppedMoving)).toBe(true);
 });
 it('runs out of the 64 manager slots',()=>{
  const m=new NativeBreakManager();
  for(let i=0;i<64;i++)expect(m.add(init())).toBeDefined();
  expect(m.add(init())).toBeUndefined();expect(m.activeCount).toBe(64);
 });
});
