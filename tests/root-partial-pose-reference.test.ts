import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {readDff} from '../src/assets/dff';
import {modelObject} from '../src/assets/ModelObjects';
import {bindAnimation} from '../src/animation/bind';
import {PartialPose} from '../src/animation/PartialPose';
import type {NativeAnimation} from '../src/assets/ifp';
import reference from './fixtures/root-partial-pose-reference.json';
for(const [index,row] of reference.cases.entries())test(`native non-extracting skinned root pose ${index}`,()=>{
 const model=readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-skin.dff'))),object=modelObject(model),root=object.root.getObjectByName('Root')!;
 try{
  const binding=(pose:{rotation:number[];translation:number[]|null})=>{
   const clip:NativeAnimation={name:'root',duration:1,flags:0,tracks:[{name:'',boneId:10,frameType:pose.translation?2:1,times:new Float32Array([0]),rotations:new Float32Array(pose.rotation),translations:pose.translation?new Float32Array(pose.translation):undefined}]};
   return bindAnimation(model,object.root,clip);
  };
  new PartialPose(root).sample(binding(row.input.base),0,row.input.layers.map(layer=>({binding:binding(layer),amount:layer.amount,seconds:0})));
  const q=new Quaternion(),position=new Vector3(),scale=new Vector3();root.matrix.decompose(position,q,scale);
  expect(q.angleTo(new Quaternion(...row.rotation as [number,number,number,number]).normalize())).toBeLessThan(1e-6);
  position.toArray().forEach((value,i)=>expect(value).toBeCloseTo(row.translation[i],5));
 }finally{object.dispose();}
});
