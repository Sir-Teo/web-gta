import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {Matrix4,Quaternion,Vector3} from 'three';
import {readDff} from '../src/assets/dff';
import {modelObject} from '../src/assets/ModelObjects';
import {bindAnimation} from '../src/animation/bind';
import {PartialPose} from '../src/animation/PartialPose';
import type {NativeAnimation} from '../src/assets/ifp';
function setup(){
 const model=readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-skin.dff'))),object=modelObject(model);
 const clip=(name:string,rotations:{boneId:number;q:number[]}[]):NativeAnimation=>({name,duration:1,flags:0,tracks:rotations.map(({boneId,q})=>({name:boneId===-1?'tip':'',boneId,frameType:1,times:new Float32Array([0,1]),rotations:new Float32Array([...q,...q])}))});
 return {object,bind:(name:string,rotations:{boneId:number;q:number[]}[])=>bindAnimation(model,object.root,clip(name,rotations))};
}
test('equal pedal/sprint partial weights mix equally and leave untracked bones on the ride pose',()=>{
 const {object,bind}=setup();try{
  const identity=[0,0,0,1],base=bind('ride',[{boneId:10,q:identity},{boneId:-1,q:[1,0,0,0]}]),pedal=bind('pedal',[{boneId:10,q:identity}]),sprint=bind('sprint',[{boneId:10,q:[0,0,1,0]}]);
  new PartialPose().sample(base,0,[{binding:pedal,amount:.5,seconds:0},{binding:sprint,amount:.5,seconds:0}]);
  const root=object.root.getObjectByName('Root')!,tip=object.root.getObjectByName('Tip')!,q=new Quaternion(),p=new Vector3(),scale=new Vector3();root.matrix.decompose(p,q,scale);
  expect(q.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2))).toBeLessThan(1e-6);
  tip.matrix.decompose(p,q,scale);expect(q.angleTo(new Quaternion(1,0,0,0))).toBeLessThan(1e-6);expect(p.z).toBe(1);
 }finally{object.dispose();}
});
test('partial quaternion sums preserve hemisphere, fade the ride contribution and restore after removal',()=>{
 const {object,bind}=setup();try{
  const base=bind('ride',[{boneId:10,q:[0,0,0,1]}]),a=bind('a',[{boneId:10,q:[0,0,1,0]}]),b=bind('b',[{boneId:10,q:[0,0,-1,0]}]),pose=new PartialPose(),root=object.root.getObjectByName('Root')!;
  pose.sample(base,0,[{binding:a,amount:.25,seconds:0},{binding:b,amount:.25,seconds:0}]);
  expect(root.matrix.elements[0]).toBeCloseTo(0,6);expect(root.matrix.elements[1]).toBeCloseTo(1,6);
  pose.sample(base,0,[]);expect(root.matrix).toEqual(new Matrix4());
 }finally{object.dispose();}
});
