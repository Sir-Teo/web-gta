import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {playerBodyRatios,blendPlayerGeometry,blendPlayerTextures} from '../src/assets/blendPlayerBody';
import {readPlayerBaseBody,PLAYER_CLASSIC_FILES} from '../src/assets/readPlayerBaseBody';
import type {ModelGeometry} from '../src/assets/dff';
import type {ModelTexture} from '../src/assets/modelTextures';
// CClothesBuilder's blend of CJ's normal, fat and ripped bodies, as the iOS executable has it.
const files=()=>new Map(PLAYER_CLASSIC_FILES.map(name=>[name,new Uint8Array(readFileSync(`public/play/world/files/player/${name}`))] as const));
test('the ratios: fat past 200 over 800, muscle over 1000, shared out when together they pass 1',()=>{
 expect(playerBodyRatios(0,0)).toEqual({normal:1,fat:0,ripped:0});
 expect(playerBodyRatios(200,0)).toEqual({normal:1,fat:0,ripped:0});
 expect(playerBodyRatios(600,250)).toEqual({normal:.25,fat:.5,ripped:.25});
 expect(playerBodyRatios(1000,0)).toEqual({normal:0,fat:1,ripped:0});
 // 1000 fat and 1000 muscle: one each, scaled to a half each.
 expect(playerBodyRatios(1000,1000)).toEqual({normal:0,fat:.5,ripped:.5});
 expect(playerBodyRatios(5000,-30)).toEqual({normal:0,fat:1,ripped:0});
});
const vertex=(position:number[],normal:number[],uv:number[],bones:number[],weights:number[]):ModelGeometry=>({positions:new Float32Array(position),normals:new Float32Array(normal),uvs:[new Float32Array(uv)],indices:new Uint32Array([0,0,0]),materialIds:new Uint16Array([0]),materials:[],flags:0,
 skin:{boneCount:8,maxWeights:4,usedBones:new Uint8Array(),indices:new Uint8Array(bones),weights:new Float32Array(weights),inverseMatrices:new Float32Array(128)}});
test('a vertex blends position, normal and UV by the ratios and merges its bodies\' bone weights',()=>{
 const normal=vertex([0,0,0],[1,0,0],[0,0],[1,2,0,0],[.75,.25,0,0]),fat=vertex([2,0,0],[0,1,0],[1,0],[1,3,0,0],[.5,.5,0,0]),ripped=vertex([0,4,0],[0,1,0],[0,1],[1,0,0,0],[1,0,0,0]);
 const out=blendPlayerGeometry(normal,fat,ripped,{normal:.5,fat:.25,ripped:.25});
 expect([...out.positions]).toEqual([.5,1,0]);
 // (0.5, 0.5, 0) made unit length.
 expect(out.normals![0]).toBeCloseTo(Math.SQRT1_2,6);expect(out.normals![1]).toBeCloseTo(Math.SQRT1_2,6);
 expect([...out.uvs[0]]).toEqual([.25,.25]);
 // Bone 1 from all three (0.375 + 0.125 + 0.25), bone 2 from normal, bone 3 from fat; three bones, so no rescaling.
 expect([...out.skin!.indices]).toEqual([1,2,3,0]);expect([...out.skin!.weights]).toEqual([.75,.125,.125,0]);
 // The normal body's triangles stand.
 expect(out.indices).toEqual(normal.indices);
});
test('a fifth bone is dropped and the first four, in the order they came, rescaled to one',()=>{
 const normal=vertex([0,0,0],[0,0,1],[0,0],[1,2,3,0],[.5,.25,.25,0]),fat=vertex([0,0,0],[0,0,1],[0,0],[4,5,0,0],[.5,.5,0,0]),ripped=vertex([0,0,0],[0,0,1],[0,0],[1,0,0,0],[1,0,0,0]);
 const out=blendPlayerGeometry(normal,fat,ripped,{normal:.5,fat:.5,ripped:0});
 // 1: .25, 2: .125, 3: .125, 4: .25, (5: .25 dropped); the four sum to .75.
 expect([...out.skin!.indices]).toEqual([1,2,3,4]);
 expect([...out.skin!.weights].map(w=>+w.toFixed(6))).toEqual([1/3,1/6,1/6,1/3].map(w=>+w.toFixed(6)));
});
test('skin pixels blend their colour by the ratios, cut to whole numbers, and keep the normal alpha',()=>{
 const texture=(rgba:number[]):ModelTexture=>({name:'torso',filter:1,addressU:1,addressV:1,hasAlpha:false,mips:[{width:1,height:1,data:new Uint8ClampedArray(rgba)}]});
 const out=blendPlayerTextures(texture([100,0,255,200]),texture([201,90,0,0]),texture([0,30,10,9]),{normal:.5,fat:.25,ripped:.25});
 // 50 + 50.25 + 0, 0 + 22.5 + 7.5, 127.5 + 0 + 2.5.
 expect([...out.mips[0].data]).toEqual([100,30,130,200]);expect(out.hasAlpha).toBe(true);
});
test("CJ's published bodies: the blend's ends are the three bodies, and between them it is in between",()=>{
 const f=files();
 const at=(ratios:{normal:number;fat:number;ripped:number})=>readPlayerBaseBody(f,ratios,'classic');
 for(const [variant,ratios] of [['normal',{normal:1,fat:0,ripped:0}],['fat',{normal:0,fat:1,ripped:0}],['ripped',{normal:0,fat:0,ripped:1}]] as const){
  const whole=readPlayerBaseBody(f,variant,'classic'),blended=at(ratios);
  // The normal body's triangles throughout; at one ratio the vertices are that body's.
  blended.model.geometries.forEach((g,i)=>{
   const w=whole.model.geometries[i];expect(g.positions.length).toBe(w.positions.length);
   for(let k=0;k<g.positions.length;k++)expect(g.positions[k]).toBeCloseTo(w.positions[k],5);
  });
  // The torso and legs skins, under the vest and jeans, are that body's raster.
  for(const slot of [0,2])expect(blended.textures[slot].mips[0].data).toEqual(whole.textures[slot].mips[0].data);
  expect(blended.textures.map(t=>t.name)).toEqual(['torso','face','legs','foot']);
 }
 const half=at({normal:.5,fat:.5,ripped:0}),normal=readPlayerBaseBody(f,'normal','classic'),fat=readPlayerBaseBody(f,'fat','classic');
 const torso=half.model.geometries[0],a=normal.model.geometries[0].positions,b=fat.model.geometries[0].positions;
 for(let k=0;k<torso.positions.length;k+=97)expect(torso.positions[k]).toBeCloseTo((a[k]+b[k])/2,5);
 // Every vertex's weights still sum to one.
 for(const g of half.model.geometries)for(let v=0;v<g.skin!.weights.length;v+=4){
  const sum=g.skin!.weights[v]+g.skin!.weights[v+1]+g.skin!.weights[v+2]+g.skin!.weights[v+3];expect(sum).toBeCloseTo(1,5);
 }
});
