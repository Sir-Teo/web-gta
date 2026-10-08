import {expect,test} from 'vitest';
import {MISSION_HELI_FLYTOCOORS,flyAIHeliInCertainDirection,heliProbeDue,newHeliAI,steerAIHeliTowardsTargetCoors,type HeliPilot} from '../src/simulation/nativeHeliAI';
import type {NativeVec} from '../src/simulation/nativeFlyingControl';

const pilot=(destination:NativeVec):HeliPilot=>({mission:MISSION_HELI_FLYTOCOORS,cruiseSpeed:100,heliSpeedMult:0,heliTargetDist2:10,destination,rc:false,forcedOrientation:-1});
// Facing north (+y), still, at 50 up.
const body=()=>({position:[0,0,50] as NativeVec,moveSpeed:[0,0,0] as NativeVec,right:[1,0,0] as NativeVec,forward:[0,1,0] as NativeVec});
const open={lineOfSight:()=>undefined,rand:()=>7};

test('a far target: full forward pitch, the collective toward the held height, a yaw toward the target',()=>{
 const ai=newHeliAI();ai.maxAltitude=50;ai.minAltitude=10;
 steerAIHeliTowardsTargetCoors(ai,body(),pilot([0,500,0]),open,true,1);
 expect(ai.holdHeight).toBe(50);expect(ai.pitch).toBeCloseTo(-.8);expect(ai.yaw).toBeCloseTo(0);expect(ai.roll).toBe(0);expect(ai.accel).toBeCloseTo(0);
 // 30 below the held height it climbs at a tenth of the gap (noise 0 at rand() & 15 = 7), and climbing that hard it
 // holds its pitch back.
 const low=newHeliAI();low.maxAltitude=80;
 steerAIHeliTowardsTargetCoors(low,body(),pilot([0,500,0]),open,true,1);
 expect(low.accel).toBeCloseTo(1);expect(low.pitch).toBeCloseTo(0);
 // A target off to the east (heading 0 against a facing of π/2): yaw right, and no forward pitch past 27 degrees off.
 const east=newHeliAI();east.maxAltitude=50;
 steerAIHeliTowardsTargetCoors(east,body(),pilot([500,0,0]),open,true,1);
 expect(east.yaw).toBe(1);expect(east.pitch).toBeCloseTo(0);
});

test('the half-second look ahead holds the minimum altitude over what it sees ahead, and rolls away from the nearer wall',()=>{
 const ai=newHeliAI();ai.maxAltitude=40;ai.minAltitude=10;
 // The ground-ahead ray hits a roof at 45; the straight-ahead ray hits too; the right side is walled 3 units along.
 const world={rand:()=>7,lineOfSight:(from:NativeVec,to:NativeVec):NativeVec|undefined=>{
  if(to[2]<from[2]-1)return [0,30,45];
  if(from[0]===10)return [10,from[1]+3,from[2]];
  if(from[0]===0&&Math.abs(to[0])<1e-6)return [0,from[1]+20,from[2]];
  return undefined;
 }};
 flyAIHeliInCertainDirection(ai,body(),pilot([0,500,0]),world,Math.PI/2,500,true,true,1);
 expect(ai.holdHeight).toBe(55);expect(ai.blockedAhead).toBe(true);
 expect(ai.roll).toBe(.5);
 // Blocked ahead, it brakes: twice its forward speed, none at a standstill.
 expect(ai.pitch).toBeCloseTo(0);
 // Between the half-second marks the held height and the roll stay.
 expect(heliProbeDue(1499,1495,0)).toBe(false);expect(heliProbeDue(1501,1499,0)).toBe(true);expect(heliProbeDue(1001,999,1)).toBe(false);
});

test('within 60 of the target the pitch eases to nothing at m_ucHeliTargetDist2, and keeps its last value inside it',()=>{
 const ai=newHeliAI();ai.maxAltitude=50;
 steerAIHeliTowardsTargetCoors(ai,body(),pilot([0,25,50]),open,true,1);
 // 25 to go, less the 10 of the target distance, of the 20 the ease runs over: three quarters of −0.8.
 expect(ai.pitch).toBeCloseTo(-.6);
 ai.pitch=-.123;
 steerAIHeliTowardsTargetCoors(ai,body(),pilot([0,5,50]),open,true,1);
 expect(ai.pitch).toBeCloseTo(-.123);
 // Gone past it with speed on: the target behind, it backs off at 0.3.
 const past={...body(),moveSpeed:[0,.3,0] as NativeVec};
 steerAIHeliTowardsTargetCoors(ai,past,pilot([0,-40,50]),open,true,1);
 expect(ai.pitch).toBeCloseTo(.3);
});
