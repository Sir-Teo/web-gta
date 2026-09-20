import {expect,test} from 'vitest';
import {startLookAt,stepLookAt,shouldStartLookAt,lookAtDurationMs,moveHeadToTarget,applyQuat,rotateQuat,quatToEulerDeg,eulerDegToQuat,limitHead,slerpQuat,LOOK_AT_SPEED,type Quat} from '../src/simulation/nativeIkLookAt';

test('the look-at task blends in over 500 ms, holds, and blends out before its end',()=>{
 const task=startLookAt(1000,4000);
 expect(task.blend).toBe(0);
 for(let t=1000;t<1500;t+=16.67)stepLookAt(task,t,16.67);
 expect(task.blend).toBeGreaterThan(0.9);
 stepLookAt(task,2500,16.67);expect(task.blend).toBeCloseTo(1,3);expect(task.blendingOut).toBe(false);
 // From 500 ms before the end the target is 0 and the blend falls.
 expect(stepLookAt(task,4600,16.67)).toBe(true);expect(task.blendingOut).toBe(true);expect(task.blend).toBeLessThan(1);
 for(let t=4600;t<5000;t+=16.67)stepLookAt(task,t,16.67);
 expect(stepLookAt(task,5000,16.67)).toBe(false);expect(task.blend).toBe(0);
});
test('the interesting-entity roll is one frame in a hundred for an on-screen ped that is not looking, 3 to 5 s',()=>{
 expect(shouldStartLookAt(true,false,()=>0.505)).toBe(true);
 expect(shouldStartLookAt(true,false,()=>0.2)).toBe(false);
 expect(shouldStartLookAt(false,false,()=>0.505)).toBe(false);
 expect(shouldStartLookAt(true,true,()=>0.505)).toBe(false);
 expect(lookAtDurationMs(()=>0)).toBe(3000);expect(lookAtDurationMs(()=>0.999)).toBeLessThan(5000);
});
test('the head turns a quarter of the way toward the target each frame and stops within 0.997 of it',()=>{
 const identity:Quat=[0,0,0,1],effector:[number,number,number]=[0,0.05,0];
 // Target straight ahead of the effector: no turn.
 expect(moveHeadToTarget(identity,effector,[0,1,0],LOOK_AT_SPEED)).toEqual(identity);
 // Target 90° to the right: the first step turns 22.5°.
 const once=moveHeadToTarget(identity,effector,[1,0,0],LOOK_AT_SPEED);
 const dir=applyQuat(once,[0,1,0]);
 expect(Math.atan2(dir[0],dir[1])*180/Math.PI).toBeCloseTo(22.5,3);
 // Repeated steps close in geometrically.
 let q=identity;for(let i=0;i<12;i++)q=moveHeadToTarget(q,effector,[1,0,0],LOOK_AT_SPEED);
 const d=applyQuat(q,[0,1,0]);expect(Math.atan2(d[0],d[1])*180/Math.PI).toBeGreaterThan(85);
 // Rotating about z by 90° maps +y to -x (post-concatenated rotation in the parent space).
 const r=rotateQuat(identity,[0,0,1],Math.PI/2);expect(applyQuat(r,[0,1,0])[0]).toBeCloseTo(-1,5);
});
test('Euler conversions round trip and the head limits clamp yaw, pitch and a pitch-scaled roll',()=>{
 for(const e of [[10,20,30],[-40,5,0],[0,0,0]] as [number,number,number][]){
  const back=quatToEulerDeg(eulerDegToQuat(e));
  for(let i=0;i<3;i++)expect(back[i]).toBeCloseTo(e[i],3);
 }
 const wide=eulerDegToQuat([120,0,0]);
 expect(quatToEulerDeg(limitHead(wide,[0,0,0]))[0]).toBeCloseTo(80,2);
 expect(quatToEulerDeg(limitHead(eulerDegToQuat([0,60,0]),[0,0,0]))[1]).toBeCloseTo(35,2);
 const rolled=eulerDegToQuat([40,0,30]);
 // At 40° about x the z range shrinks to (1 - 40/45) of 25°.
 expect(Math.abs(quatToEulerDeg(limitHead(rolled,[0,0,0]))[2])).toBeLessThan(3.5);
 const a:Quat=[0,0,0,1],b=eulerDegToQuat([0,60,0]);
 expect(quatToEulerDeg(slerpQuat(a,b,0.5))[1]).toBeCloseTo(30,3);
 expect(slerpQuat(a,b,0)).toEqual(a);
});
