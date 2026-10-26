import {expect,test} from 'vitest';
import {Group} from 'three';
import reference from './fixtures/boat-flap-reference.json';
import {NativeBoatFlap,type BoatFlapMotion} from '../src/simulation/nativeBoatFlap';
import {bindNativeBoatComponents} from '../src/render/nativeBoatComponents';
const axes={right:[1,0,0],forward:[0,1,0],up:[0,0,1]} as BoatFlapMotion['axes'];
const motion=(x=0):BoatFlapMotion=>({axes,moveSpeed:[x,0,0],turnSpeed:[0,0,0],centerOfMass:[0,0,0]});
test('Marquis hinge initialization matches the selected executable, including native Z axis',()=>{
 const flap=new NativeBoatFlap(),r=reference.constructors.find(r=>r.model===484)!;
 expect({openAngle:flap.openAngle,closedAngle:flap.closedAngle,dirn:flap.dirn,axis:flap.axis,state:flap.state}).toEqual({openAngle:r.openAngle,closedAngle:r.closedAngle,dirn:r.dirn,axis:r.axis,state:r.state});
});
for(const [i,r] of reference.cases.entries())test(`native boat hinge integration capture ${i}`,()=>{
 const flap=new NativeBoatFlap();flap.angle=r.angle;flap.angVel=r.angVel;flap.state=4;flap.integrate(r.torque);
 expect({angle:flap.angle,angVel:flap.angVel,state:flap.state}).toEqual({angle:r.nextAngle,angVel:r.nextAngVel,state:r.state});
});
test('constant translation stops applying acceleration after the first rendered frame',()=>{
 const flap=new NativeBoatFlap();flap.step([0,2,1],motion(.1),1);const velocity=flap.angVel;
 expect(velocity).toBe(Math.fround(-Math.fround(.1)*Math.fround(.98)));
 flap.step([0,2,1],motion(.1),1);expect(flap.angVel).toBe(Math.fround(velocity*Math.fround(.98)));
});
test('GetSpeed uses the current COM offset while previous point speed uses the frame offset',()=>{
 const flap=new NativeBoatFlap(),m=motion();m.turnSpeed=[0,0,.1];m.centerOfMass=[0,1,0];flap.step([0,2,0],m,0);
 expect(flap.angVel).toBe(Math.fround(Math.fround(.1)*Math.fround(.98)));
 // First position rotates about the COM, but oldTurn cross frame offset is -0.2 on the next call.
 flap.angle=0;flap.angVel=0;flap.step([0,2,0],m,0);expect(flap.angVel).toBeLessThan(0);
});
test('gravity only produces hinge torque when the hull is tilted and uses the game timestep',()=>{
 const flat=new NativeBoatFlap();flat.step([0,0,0],motion(),2);expect(flat.angle).toBe(0);
 const tilted=motion();tilted.axes={right:[0,0,1],forward:[0,1,0],up:[-1,0,0]};const a=new NativeBoatFlap(),b=new NativeBoatFlap();a.step([0,0,0],tilted,1);b.step([0,0,0],tilted,2);expect(a.angle).toBeLessThan(0);expect(b.angle).toBe(Math.fround(a.angle*2));
});
test('Marquis frame replaces its Z basis, preserves translation, and integrates once even at zero timestep',()=>{
 const root=new Group(),frame=new Group();frame.name='boat_flap_left';frame.matrixAutoUpdate=false;frame.matrix.makeRotationX(.7).setPosition(2,3,4);root.add(frame);const components=bindNativeBoatComponents(root,484);
 expect(components.needsMotion).toBe(true);components.update(0,0,.02,motion(.1));const angle=components.snapshot().flap!.angle;
 expect(frame.matrix.elements.slice(12,15)).toEqual([2,3,4]);expect(frame.matrix.elements[1]).toBe(Math.fround(Math.sin(angle)));expect(frame.matrix.elements[10]).toBe(1);
 components.update(0,0,0,motion(.1));expect(components.snapshot().flap!.angle).toBeLessThan(angle);
 frame.matrix.setPosition(5,6,7);components.update(0,0,0,motion(.1));expect(frame.matrix.elements.slice(12,15)).toEqual([5,6,7]);
});
test('other models and a missing optional flap retain their original basis',()=>{
 for(const model of [430,452,484]){const root=new Group(),frame=new Group();frame.name=model===484?'absent_flap':'boat_flap_left';frame.matrixAutoUpdate=false;frame.matrix.makeRotationX(.7);root.add(frame);const before=frame.matrix.clone(),components=bindNativeBoatComponents(root,model);expect(components.needsMotion).toBe(false);components.update(0,0,.02,motion(.1));expect(frame.matrix.equals(before)).toBe(true);}
});
