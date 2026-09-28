import {expect,test} from 'vitest';
import {bikeCanJumpOut,bikeCanStepOut} from '../src/simulation/BikeMount';
const still={x:0,y:0,z:0};
test('bikes step off only when still, by the base CanPedStepOutCar limits in units per frame',()=>{
 expect(bikeCanStepOut(still,still)).toBe(true);
 expect(bikeCanStepOut({x:.49,y:0,z:0},still)).toBe(true);   // |v2D| 0.0098 units/frame
 expect(bikeCanStepOut({x:.6,y:0,z:0},still)).toBe(false);
 expect(bikeCanStepOut({x:0,y:2.6,z:0},still)).toBe(false);  // |vz| over 0.05
 expect(bikeCanStepOut(still,{x:1.1,y:0,z:0})).toBe(false);  // |ω|² over 0.0004
});
test('bikes are jumped off from v2D² ≥ 0.07 units/frame, and never by a rider carrying a pillion',()=>{
 const edge=Math.sqrt(.07)*50;
 expect(bikeCanJumpOut({x:edge+.01,y:0,z:0},false)).toBe(true);
 expect(bikeCanJumpOut({x:edge-.05,y:0,z:0},false)).toBe(false);
 expect(bikeCanJumpOut({x:20,y:0,z:0},true)).toBe(false);
});
test('the quad (a CAutomobile) is jumped off only between v2D² 0.1 and 0.5 units/frame, pillion or not',()=>{
 const low=Math.sqrt(.1)*50,high=Math.sqrt(.5)*50;
 expect(bikeCanJumpOut({x:14,y:0,z:0},false,true)).toBe(false);   // a bike's jump-out speed, below the car band
 expect(bikeCanJumpOut({x:low+.01,y:0,z:0},true,true)).toBe(true);
 expect(bikeCanJumpOut({x:high+.1,y:0,z:0},false,true)).toBe(false);
});

// CVehicle::CanPedJumpOutCar's automobile branch for the quad: the 0.1..0.5 window, unless it is tipped past up.z 0.3
// and was hit within the last second, when any 0.1 or more lets the rider roll off.
test('a tipped, just-crashed quad lets the rider roll off at any speed from 0.1 units a frame',()=>{
 const v=(unitsPerFrame:number)=>({x:0,y:0,z:unitsPerFrame*50});
 expect(bikeCanJumpOut(v(Math.sqrt(.3)),false,true)).toBe(true);
 expect(bikeCanJumpOut(v(Math.sqrt(.6)),false,true)).toBe(false);
 expect(bikeCanJumpOut(v(Math.sqrt(.6)),false,true,true)).toBe(true);
 expect(bikeCanJumpOut(v(Math.sqrt(.05)),false,true,true)).toBe(false);
});
import {BikeMount} from '../src/simulation/BikeMount';
// CTaskSimpleBikeJacked: the ride group's BIKE_HIT plays on the saddle first; FinishAnimBikeHitCB then hands over to
// the fall-off clip and the forced knock-off.
test('a rider pulled off a bike takes the hit clip on the saddle before he falls',()=>{
 const hit={duration:.8,tracks:[]} as any;let pulled=0;
 const bike:any={occupied:true,disposed:false,wrecked:false,brake:false,throttle:1,assets:{vehicle:{animation:'BIKEs'}},seat:()=>({x:0,y:0,z:.5}),pulledOff(){pulled++;return true;}};
 const mount=new BikeMount({player:{position:{x:0,y:0,z:0}}} as any,{peek:(file:string,name:string)=>file==='BIKEs'&&name==='bikes_hit'?hit:undefined} as any);
 expect(mount.jacked(bike)).toBe(true);expect(mount.phase).toBe('jacked');expect(mount.pinned).toBe(false);
 expect(mount.pose()).toMatchObject({clip:'bikes_hit',seconds:0,local:{x:0,y:0,z:.5}});
 mount.step(.5);expect(pulled).toBe(0);expect(bike.brake).toBe(true);expect(bike.throttle).toBe(0);
 mount.step(.4);expect(pulled).toBe(1);expect(mount.active).toBe(false);
 // Without the clip loaded the pull-off is immediate (the caller's fallback).
 const bare=new BikeMount({player:{position:{x:0,y:0,z:0}}} as any,{peek:()=>undefined} as any);
 expect(bare.jacked(bike)).toBe(false);
});
