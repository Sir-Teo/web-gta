import {expect,test} from 'vitest';
import {addWakePoint,applyNativeBoatBuoyancy,boatBounds,boatVolumeClass,createWakeTrail,pruneWakeTrail,WAKE,type NativeBoatBody,type NativeVec} from '../src/simulation/nativeBuoyancy';

const hull=(over:Partial<NativeBoatBody>={}):NativeBoatBody=>({
 position:[0,0,0],right:[1,0,0],forward:[0,1,0],up:[0,0,1],
 boundsMin:[-1,-3,-.5],boundsMax:[1,3,.5],modelId:446,touchingWater:false,
 mass:2000,turnMass:5000,centerOfMass:[0,0,0],buoyancyConstant:2000*.8/75,
 moveSpeed:[0,0,0],turnSpeed:[0,0,0],suspensionDamping:.5,...over,
});
const flat=()=>0;

test('boat volume classes and bounds follow the source model lists',()=>{
 expect(boatVolumeClass(446)).toBe('speed');expect(boatVolumeClass(452)).toBe('speed');
 expect(boatVolumeClass(493)).toBe('speed');expect(boatVolumeClass(595)).toBe('speed');
 expect(boatVolumeClass(472)).toBe('dinghy');expect(boatVolumeClass(473)).toBe('dinghy');
 expect(boatVolumeClass(484)).toBe('sail');
 expect(boatVolumeClass(430)).toBe('standard');expect(boatVolumeClass(453)).toBe('standard');
 const squalo=boatBounds(446,[-1,-3,-.5],[1,3,.5]);
 expect(squalo.min[1]).toBeCloseTo(-2.7,10);expect(squalo.max[1]).toBeCloseTo(2.7,10);
 const tropic=boatBounds(454,[-1,-3,-.5],[1,3,.5]);
 expect(tropic.max[1]).toBeCloseTo(3.9,10);expect(tropic.min[2]).toBeCloseTo(-.7,10);
 const predator=boatBounds(430,[-1,-3,-.5],[1,3,.5]);
 expect(predator.max[1]).toBeCloseTo(3.15,10);expect(predator.min[1]).toBeCloseTo(-2.7,10);
});

test('a settled hull floats mid-immersion with balanced force',()=>{
 const body=hull(),state:{sample?:never}={};
 const result=applyNativeBoatBuoyancy(body,flat,1,state,9.81/20);
 expect(result.inWater).toBe(true);
 // SimpleSumBuoyancyData squares a boat's depth: half the hull height under counts a quarter.
 expect(result.immersion).toBeCloseTo(.25,6);
 expect(result.force).toBeGreaterThan(0);
 // A boat's bTouchingWater is CBoat's constructor's and is never cleared here.
 expect(body.touchingWater).toBe(hull().touchingWater);
 // Suspended above the water: dry.
 const dry=hull({position:[0,0,10]});
 expect(applyNativeBoatBuoyancy(dry,flat,1,{},9.81/20).inWater).toBe(false);
 expect(dry.touchingWater).toBe(hull().touchingWater);
});

test('deeper immersion and falling cushion the hull',()=>{
 const rest=applyNativeBoatBuoyancy(hull(),flat,1,{},9.81/20);
 const deep=applyNativeBoatBuoyancy(hull({position:[0,0,-.3]}),flat,1,{},9.81/20);
 expect(deep.force).toBeGreaterThan(rest.force);
 const falling=applyNativeBoatBuoyancy(hull({moveSpeed:[0,0,-.2]}),flat,1,{},9.81/20);
 expect(falling.force).toBeGreaterThan(rest.force);
 const moving=applyNativeBoatBuoyancy(hull({moveSpeed:[.3,0,0]}),flat,1,{},9.81/20);
 expect(moving.force).toBeCloseTo(rest.force,10);
});

test('roll torque is symmetric and restoring',()=>{
 const roll=(angle:number):NativeVec=>{
  const c=Math.cos(angle),s=Math.sin(angle);
  const body=hull({right:[c,0,-s],forward:[0,1,0],up:[s,0,c]});
  applyNativeBoatBuoyancy(body,flat,1,{},9.81/20);
  return body.turnSpeed;
 };
 const level=roll(0);
 expect(Math.hypot(...level)).toBeLessThan(1e-9);
 const plus=roll(.1),minus=roll(-.1);
 expect(plus[1]).not.toBeCloseTo(0,12);
 expect(plus[1]).toBeCloseTo(-minus[1],10);
 // Rolled right-side-down, the torque rolls back (negative about forward for +roll).
 expect(plus[1]).toBeLessThan(0);
});

test('wake points queue newest-first with spacing, caps and decay',()=>{
 const trail=createWakeTrail();
 addWakePoint(trail,{x:0,y:0},.5);
 expect(trail.coords).toHaveLength(1);
 expect(trail.speeds).toEqual([50]);expect(trail.counters).toEqual([WAKE.lifetime]);
 // Too close to the last point: ignored.
 addWakePoint(trail,{x:1,y:0},2);
 expect(trail.coords).toHaveLength(1);
 addWakePoint(trail,{x:3,y:0},3);
 expect(trail.coords.map(c=>c.x)).toEqual([3,0]);
 // The intensity is cast to a uint8: 300 wraps to 44.
 expect(trail.speeds[0]).toBe(44);
 // Decay prunes the oldest first.
 for(let i=0;i<WAKE.lifetime;i++)pruneWakeTrail(trail,1);
 expect(trail.coords).toHaveLength(0);
 // Capacity follows the caller (mission boats keep fewer points).
 const busy=createWakeTrail();
 for(let i=0;i<30;i++)addWakePoint(busy,{x:i*3,y:0},1,15);
 expect(busy.coords.length).toBeLessThanOrEqual(16);
 const player=createWakeTrail();
 for(let i=0;i<40;i++)addWakePoint(player,{x:i*3,y:0},1);
 expect(player.coords.length).toBeLessThanOrEqual(WAKE.max);
});
test('against the world (GetHasHitWall) the hull points turn nothing; the drive turns 0.4 of the force instead',()=>{
 const s=Math.sin(.2),c=Math.cos(.2);
 const tilted=()=>hull({right:[c,0,s],up:[-s,0,c],position:[0,0,-.1]});
 const free=tilted(),walled=tilted();
 applyNativeBoatBuoyancy(free,flat,1,{});applyNativeBoatBuoyancy(walled,flat,1,{},1,true);
 expect(Math.abs(free.turnSpeed[1])).toBeGreaterThan(1e-5);
 expect(walled.turnSpeed[1]).toBe(0);
});
