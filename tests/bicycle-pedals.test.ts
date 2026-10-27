import {expect,test} from 'vitest';
import {Group,Matrix4} from 'three';
import {stepBicycleCrank} from '../src/simulation/bicycleCrank';
import {bindBicyclePedals} from '../src/render/bicyclePedals';

test('the crank follows pedal or sprint association phase and eases at rest with the native timestep',()=>{
 expect(stepBicycleCrank(2,1,{seconds:.2,duration:.8})).toBeCloseTo(-Math.PI/2,6);
 expect(stepBicycleCrank(2,1,{seconds:1,duration:.8})).toBeCloseTo(-Math.PI/2,6);
 expect(stepBicycleCrank(-4,0)).toBe(-4);
 expect(stepBicycleCrank(-4,2)).toBeCloseTo(stepBicycleCrank(stepBicycleCrank(-4,1),1),6);
 expect(stepBicycleCrank(-4,1)).toBeCloseTo(-4*.97,6);
 expect(()=>stepBicycleCrank(0,1,{seconds:0,duration:0})).toThrow();
});
test('pedal treads stay level through a wrapped revolution, retaining centers and replacing imported rest rotations',()=>{
 const root=new Group(),chain=new Group(),right=new Group(),left=new Group();root.add(chain);chain.add(right,left);
 const frames=[chain,right,left],names=['chainset','pedal_r','pedal_l'];
 frames.forEach((f,i)=>{f.matrixAutoUpdate=false;f.userData.nativeFrame=i;f.matrix.makeRotationX(i?Math.PI:0).setPosition(i,i+1,i+2);});
 const original=frames.map(f=>f.matrix.clone()),binding=bindBicyclePedals(root,{frames:names.map(name=>({name})) as any});
 binding.update(-2*Math.PI+.1,-.1,.5);root.updateMatrixWorld(true);
 const wrapped=new Matrix4().makeRotationX(-2*Math.PI);wrapped.setPosition(0,1,2);
 chain.matrix.elements.forEach((n,i)=>expect(n).toBeCloseTo(wrapped.elements[i],6));
 for(const pedal of [right,left]){
  const relative=new Matrix4().multiplyMatrices(chain.matrix,pedal.matrix);expect(relative.elements.slice(0,12)).toEqual(new Matrix4().elements.slice(0,12));
  expect(pedal.parent).toBe(chain);
 }
 const first=frames.map(f=>[...f.matrix.elements]);binding.update(-2*Math.PI+.1,-.1,.5);expect(frames.map(f=>[...f.matrix.elements])).toEqual(first);
 frames.forEach((f,i)=>expect(f.matrix.elements.slice(12,15)).toEqual(original[i].elements.slice(12,15)));
 expect(()=>binding.update(0,NaN,1)).toThrow();expect(frames.map(f=>[...f.matrix.elements])).toEqual(first);
 expect(()=>bindBicyclePedals(new Group(),{frames:[]} as any).update(0,1,1)).not.toThrow();
});
