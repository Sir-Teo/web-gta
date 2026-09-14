import {expect,test} from 'vitest';
import {Matrix4,Object3D,Vector3} from 'three';
import {playerShoulderMatrix,bindPlayerShoulders} from '../src/animation/playerShoulders';
import type {DffModel} from '../src/assets/dff';
const rotation=(x:number,y:number,z:number)=>new Matrix4().makeRotationZ(z).multiply(new Matrix4().makeRotationY(y)).multiply(new Matrix4().makeRotationX(x));
const close=(a:Matrix4,b:Matrix4)=>a.elements.forEach((n,i)=>expect(n).toBeCloseTo(b.elements[i],6));
test('player shoulders halve only arm-local X rotation and retain the arm origin',()=>{
 const clavicle=rotation(.3,-.4,.2).setPosition(3,7,-2),local=rotation(.8,.25,-.6).setPosition(.2,.1,-.3);
 const arm=clavicle.clone().multiply(local),before=arm.clone();
 const actual=playerShoulderMatrix(clavicle,arm),expected=clavicle.clone().multiply(rotation(.4,.25,-.6).setPosition(.2,.1,-.3));
 close(actual,expected);close(arm,before);
 expect(new Vector3().setFromMatrixPosition(actual).distanceTo(new Vector3().setFromMatrixPosition(arm))).toBeLessThan(1e-10);
});
test('player shoulder singular branch retains pure positive and negative Y quarter turns',()=>{
 for(const y of [-Math.PI/2,Math.PI/2]){const arm=rotation(0,y,.35);close(playerShoulderMatrix(new Matrix4(),arm),arm);}
});
test('bound shoulder correction respects helper parents and does not accumulate across frames',()=>{
 const root=new Object3D(),ids=[3,21,22,301,31,32,302];
 const frames=ids.map((id,i)=>({name:String(id),parent:i?0:-1,matrix:new Matrix4().toArray(),hanim:{id,version:256,flags:0,keyFrameSize:0,nodes:[]}}));
 const objects=frames.map((f,i)=>{const o=new Object3D();o.userData.nativeFrame=i;o.matrixAutoUpdate=false;(i?root.children[0]:root).add(o);return o;});
 objects[0].matrix.copy(rotation(.1,.2,.3).setPosition(1,2,3));
 objects[2].matrix.copy(rotation(.8,.1,.2).setPosition(.3,0,0));objects[5].matrix.copy(rotation(-.6,.3,.2).setPosition(-.3,0,0));
 const model={frames,geometries:[],atomics:[],warnings:[]} as DffModel,correction=bindPlayerShoulders(model,root);
 root.updateMatrixWorld(true);const armBefore=objects[2].matrix.clone();
 correction.update();const before=objects[3].matrixWorld.clone();
 close(before,playerShoulderMatrix(objects[1].matrixWorld,objects[2].matrixWorld));
 correction.update();close(objects[3].matrixWorld,before);close(objects[2].matrix,armBefore);
 expect(()=>bindPlayerShoulders({...model,frames:frames.filter(f=>f.hanim.id!==301)},root)).toThrow('shoulder bone');
});
