import {test,expect} from 'vitest';
import {remapPlayerSkin} from '../src/assets/remapPlayerSkin';
import type {SkinData,HAnimData} from '../src/assets/skin';
const hierarchy=(ids:number[]):HAnimData=>({version:256,id:0,flags:0,keyFrameSize:0,nodes:ids.map((id,index)=>({id,index,flags:0}))});
const skin=(boneCount:number,indices=[0,1,2,2],weights=[.25,.75,0,0]):SkinData=>({boneCount,maxWeights:2,usedBones:new Uint8Array([0,1]),indices:new Uint8Array(indices),weights:new Float32Array(weights),inverseMatrices:new Float32Array(boneCount*16)});
test('clothing skin remaps bone IDs rather than palette slots and tolerates only unweighted absent bones',()=>{
 const source=skin(3),target=skin(2);target.inverseMatrices.fill(2);
 const mapped=remapPlayerSkin(source,hierarchy([10,20,30]),target,hierarchy([20,10]));
 expect([...mapped.indices]).toEqual([1,0,0,0]);expect([...mapped.usedBones]).toEqual([0,1]);expect(mapped.boneCount).toBe(2);expect(mapped.weights).toEqual(source.weights);expect(mapped.inverseMatrices).toEqual(target.inverseMatrices);
 mapped.weights[0]=0;mapped.inverseMatrices[0]=9;expect(source.weights[0]).toBe(.25);expect(target.inverseMatrices[0]).toBe(2);expect([...source.indices]).toEqual([0,1,2,2]);
 expect(()=>remapPlayerSkin(skin(3,[0,2,0,0]),hierarchy([10,20,30]),target,hierarchy([20,10]))).toThrow('Weighted clothing bone 2');
 expect(()=>remapPlayerSkin(source,hierarchy([10,10,30]),target,hierarchy([20,10]))).toThrow('hierarchy');
});
test('all acquired body variants map their weighted bones to the native 32-bone player template',async()=>{
 const root=process.env.GTA_CONTENT_DIR;if(!root)return;
 const {readFile}=await import('node:fs/promises'),{readDff}=await import('../src/assets/dff');
 const template=readDff(new Uint8Array(await readFile(root+'/player/player.dff'))),target=template.geometries[0].skin!,targetHierarchy=template.frames.find(f=>f.hanim?.nodes.length)!.hanim!;
 expect(target.boneCount).toBe(32);expect(template.geometries[0].positions.length/3).toBe(6);
 for(const name of ['torso','head','hands','legs','feet','vest']){
  const bytes=new Uint8Array(await readFile(`${root}/player/${name}.dff`));
  for(let index=0;index<3;index++){
   const model=readDff(bytes,index),source=model.geometries[0].skin!,h=model.frames.find(f=>f.hanim?.nodes.length)!.hanim!,mapped=remapPlayerSkin(source,h,target,targetHierarchy);
   expect(source.boneCount).toBe(37);expect(mapped.boneCount).toBe(32);expect(mapped.weights).toEqual(source.weights);
   for(let i=0;i<mapped.indices.length;i++)if(mapped.weights[i]>0)expect(targetHierarchy.nodes.find(n=>n.index===mapped.indices[i])!.id).toBe(h.nodes.find(n=>n.index===source.indices[i])!.id);
  }
 }
});
