import {expect,test} from 'vitest';
import {MAX_ESCALATORS,MAX_ESCALATOR_STEPS,NativeEscalatorField,advanceEscalatorPosition,escalatorStepIsSloped,escalatorStepPose,planEscalator} from '../src/world/nativeEscalators';
import {readTwoDEffects,EFFECT} from '../src/assets/twoDEffect';

// A flight running north: the lower flat from (0,0,0) to (0,6,0), the slope up to (0,16,8), the upper flat to (0,22,8).
const plan=()=>planEscalator([0,0,0],[0,6,0],[0,16,8],[0,22,8],false,0.2);

test('the plan drops every point by the step height, counts the planes and takes the rotation from the lower run',()=>{
 const p=plan();
 expect(p.start).toEqual([0,0,-.2]);expect(p.end).toEqual([0,22,7.8]);
 // The slope is sqrt(100+64) long: one plane plus two and a half a unit.
 expect(p.intermediatePlanes).toBe(1+Math.trunc(Math.hypot(10,8)*2.5));
 // Each flat run is six units: one plane plus one every 3.2.
 expect(p.bottomPlanes).toBe(2);expect(p.topPlanes).toBe(2);
 expect(p.steps).toBe(Math.min(MAX_ESCALATOR_STEPS,p.intermediatePlanes+p.bottomPlanes+p.topPlanes));
 // The start lies south of the bottom, so forward points south and right points west.
 expect(p.rotation).toEqual([[-1,-0,0],[0,-1,0],[0,0,1]]);
 expect(p.bounding.centre).toEqual([0,11,3.8]);expect(p.bounding.radius).toBeCloseTo(Math.hypot(11,4),6);
});
test('the position wraps every unit, forwards going up and backwards going down',()=>{
 expect(advanceEscalatorPosition(0,25,false)).toBeCloseTo(0,9);
 expect(advanceEscalatorPosition(0,12.5,false)).toBeCloseTo(.5,9);
 expect(advanceEscalatorPosition(.9,5,false)).toBeCloseTo(.1,9);
 expect(advanceEscalatorPosition(0,12.5,true)).toBeCloseTo(.5,9);
 expect(advanceEscalatorPosition(.1,5,true)).toBeCloseTo(.9,9);
});
test('the sloped steps run back from the top and the flat steps out from the start and the top',()=>{
 const p=plan();
 // The first sloped step sits one plane-scale back from the top along the direction to the bottom.
 const first=escalatorStepPose(p,0,0),toBottom=Math.hypot(10,8);
 expect(first.position[1]).toBeCloseTo(16-10/toBottom/2.5,6);
 expect(first.position[2]).toBeCloseTo(7.8-8/toBottom/2.5,6);
 expect(escalatorStepIsSloped(p,0)).toBe(true);
 // The sloped run climbs toward the bottom as the index grows, and its steps move against that direction going up.
 expect(escalatorStepPose(p,1,0).position[1]).toBeLessThan(first.position[1]);
 expect(first.speed[1]).toBeGreaterThan(0);
 // The first bottom step is 4/2.5 from the start toward the bottom (north), the second eight further.
 const bottomStep=escalatorStepPose(p,p.intermediatePlanes,0);
 expect(bottomStep.position).toEqual([0,4/2.5,-.2]);expect(escalatorStepIsSloped(p,p.intermediatePlanes)).toBe(false);
 expect(escalatorStepPose(p,p.intermediatePlanes+1,0).position[1]).toBeCloseTo(12/2.5,6);
 // The first top step is 4/2.5 from the top toward the end.
 const topStep=escalatorStepPose(p,p.intermediatePlanes+p.bottomPlanes,0);
 expect(topStep.position).toEqual([0,16+4/2.5,7.8]);
 // The position shifts the flat steps forward.
 expect(escalatorStepPose(p,p.intermediatePlanes,.5).position[1]).toBeCloseTo(4.5/2.5,6);
});
test('an escalator builds its steps inside the render distance and drops them past it',()=>{
 const field=new NativeEscalatorField();
 expect(field.add(plan())).toBe(true);
 const far:[number,number,number]=[0,11,1000];
 expect(field.update(far,1)).toHaveLength(0);
 expect(field.snapshot()).toMatchObject({escalators:1,built:0});
 // Within the bounding radius plus twenty the steps appear.
 const near:[number,number,number]=[0,11,3.8];
 const drawn=field.update(near,1);
 expect(drawn).toHaveLength(1);expect(drawn[0].steps).toHaveLength(plan().steps);
 expect(drawn[0].steps.filter(s=>s.sloped)).toHaveLength(plan().intermediatePlanes);
 expect(field.snapshot().built).toBe(1);
 // Three units past the build distance it goes again.
 field.update(far,1);
 expect(field.snapshot().built).toBe(0);
});
test('the field holds the native thirty-two escalators at most',()=>{
 const field=new NativeEscalatorField();
 for(let i=0;i<MAX_ESCALATORS;i++)expect(field.add(plan())).toBe(true);
 expect(field.add(plan())).toBe(false);
 field.clear();expect(field.snapshot().escalators).toBe(0);
});
test('the escalator 2d effect reads its three points and direction',()=>{
 const bytes=new Uint8Array(4+12+8+40),v=new DataView(bytes.buffer);let o=0;
 v.setUint32(o,1,true);o+=4;[1,2,3].forEach(f=>{v.setFloat32(o,f,true);o+=4;});v.setUint32(o,EFFECT.escalator,true);o+=4;v.setUint32(o,40,true);o+=4;
 for(const p of [[0,6,0],[0,16,8],[0,22,8]])for(const c of p){v.setFloat32(o,c,true);o+=4;}
 bytes[o]=1;
 const [fx]=readTwoDEffects(bytes);
 expect(fx.type).toBe(10);expect(fx.position).toEqual([1,2,3]);
 expect(fx.escalator).toEqual({bottom:[0,6,0],top:[0,16,8],end:[0,22,8],direction:1});
});
