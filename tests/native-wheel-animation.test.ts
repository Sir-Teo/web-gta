import {test,expect} from 'vitest';
import {nativeWheelRotationSpeed,stepWheelAnimation} from '../src/simulation/nativeWheelAnimation';
import {bindNativeWheelAnimation,type WheelAnimationPoses} from '../src/render/nativeWheelAnimation';
import {Group,Vector3} from 'three';
import {NATIVE_CAR_WHEELS} from '../src/simulation/nativeDriveContacts';
const input={timeStep:1,state:'normal' as const,forwardSpeed:.2,radius:.35,contactCount:4,driven:true,acceleration:.01,steering:.2,startHeight:-.03,springLength:.52,compression:.6};
const zero={rotation:0,speed:0,steering:0,height:-.43};
test('native rolling, reverse, spinning and locked-wheel states have distinct rotation speeds',()=>{
 expect(nativeWheelRotationSpeed('normal',.35,.35)).toBe(-1);expect(nativeWheelRotationSpeed('skidding',-.35,.35)).toBe(1);expect(nativeWheelRotationSpeed('spinning',0,.35)).toBe(Math.fround(-1.1));expect(nativeWheelRotationSpeed('fixed',.35,.35)).toBe(0);
 expect(()=>nativeWheelRotationSpeed('normal',1,0)).toThrow();
});
test('wheel rotation integrates timestep and follows independently resolved steering and spring travel',()=>{
 const p=stepWheelAnimation(zero,input);expect(p.rotation).toBeCloseTo(-.2/.35,6);expect(p.height).toBeCloseTo(-.03-.52*.6,6);expect(p.steering).toBe(Math.fround(.2));
 const locked=stepWheelAnimation(p,{...input,state:'fixed'});expect(locked.rotation).toBe(p.rotation);
 let half=zero;for(let i=0;i<2;i++)half=stepWheelAnimation(half,{...input,timeStep:.5});expect(half.rotation).toBe(p.rotation);
 const floating=stepWheelAnimation(zero,{...input,contactCount:0});expect(floating.speed).toBe(Math.fround(-.1));const coasting=stepWheelAnimation(floating,{...input,contactCount:0,acceleration:0});expect(coasting.speed).toBe(Math.fround(floating.speed*Math.fround(.95)));
});
test('native frame animation preserves wheel centers and authored scale, interpolates without drift and rejects partial updates',()=>{
 const root=new Group(),indices={} as Record<typeof NATIVE_CAR_WHEELS[number],number>;NATIVE_CAR_WHEELS.forEach((wheel,i)=>{const frame=new Group();frame.matrixAutoUpdate=false;frame.userData.nativeFrame=i;frame.matrix.makeScale(1,2,3).setPosition(i,i*2,-.4);root.add(frame);indices[wheel]=i;});
 const bind=bindNativeWheelAnimation(root,indices),a=Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{...zero}])) as WheelAnimationPoses,b=Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{...zero,rotation:-1,steering:.3,height:-.6}])) as WheelAnimationPoses;
 bind.update(a,b,.5);const snapshots=root.children.map(c=>[...c.matrix.elements]);bind.update(a,b,.5);expect(root.children.map(c=>[...c.matrix.elements])).toEqual(snapshots);
 root.children.forEach((frame,i)=>{expect(frame.matrix.elements[12]).toBe(i);expect(frame.matrix.elements[13]).toBe(i*2);expect(frame.matrix.elements[14]).toBeCloseTo(-.515,8);const scale=new Vector3().setFromMatrixScale(frame.matrix);expect(scale.x).toBeCloseTo(1,8);expect(scale.y).toBeCloseTo(2,8);expect(scale.z).toBeCloseTo(3,8);});
 const bad=structuredClone(b);bad.rearRight.height=NaN;expect(()=>bind.update(a,bad,1)).toThrow();expect(root.children.map(c=>[...c.matrix.elements])).toEqual(snapshots);
});
