import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {Matrix4,Quaternion,Vector3} from 'three';
import {readDff} from '../src/assets/dff';
import {modelObject} from '../src/assets/ModelObjects';
import {bindAnimation} from '../src/animation/bind';
import {PartialPose} from '../src/animation/PartialPose';
import type {NativeAnimation} from '../src/assets/ifp';
import reference from './fixtures/partial-pose-reference.json';
for(const [index,row] of reference.cases.entries())test(`native static-key skinned partial frame ${index}`,()=>{
 const model=readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-skin.dff'))),rootIndex=model.frames.findIndex(frame=>frame.hanim?.id===10);
 model.frames[rootIndex].matrix=new Matrix4().makeTranslation(...row.input.rest as [number,number,number]).elements;
 const object=modelObject(model);
 try{
  const binding=(pose:{rotation:number[];translation:number[]|null})=>{
   const clip:NativeAnimation={name:'static',duration:1,flags:0,tracks:[{name:'',boneId:10,frameType:pose.translation?2:1,times:new Float32Array([0]),rotations:new Float32Array(pose.rotation),translations:pose.translation?new Float32Array(pose.translation):undefined}]};
   return bindAnimation(model,object.root,clip);
  };
  const layers=row.input.layers.filter((layer:{amount:number;valid?:boolean})=>layer.valid!==false).map(layer=>({binding:binding(layer),amount:layer.amount,seconds:0}));
  new PartialPose().sample(binding(row.input.base),0,layers);
  const target=object.root.getObjectByName('Root')!,q=new Quaternion(),position=new Vector3(),scale=new Vector3();target.matrix.decompose(position,q,scale);
  expect(q.angleTo(new Quaternion(...row.rotation as [number,number,number,number]).normalize())).toBeLessThan(1e-6);
  position.toArray().forEach((value,i)=>expect(value).toBeCloseTo(row.translation[i],5));
 }finally{object.dispose();}
});
