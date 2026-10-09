import {expect,test} from 'vitest';
import {raySphere,occupantHeadHit,canPedStepOutCar,dieInCarPlan,OCCUPANT_HEAD_RADIUS,OCCUPANT_HEAD_LIFT,DIE_IN_CAR_OFFSET_MS} from '../src/vehicle/nativeDieInCar';
test('a bullet line reaches a car occupant through one sphere of 0.2 about the head, the nearest of them',()=>{
 expect([OCCUPANT_HEAD_RADIUS,OCCUPANT_HEAD_LIFT]).toEqual([0.2,0.1]);expect(DIE_IN_CAR_OFFSET_MS).toBe(2000);
 expect(raySphere({x:0,y:0,z:0},{x:1,y:0,z:0},{x:5,y:0,z:0},.35)).toBeCloseTo(4.65,9);
 expect(raySphere({x:0,y:0,z:0},{x:1,y:0,z:0},{x:5,y:1,z:0},.35)).toBeUndefined();
 expect(raySphere({x:5,y:0,z:0},{x:1,y:0,z:0},{x:5,y:0,z:0},.35)).toBe(0);
 // Two heads across the car from 10 units off its side: the nearer one, entered 0.2 short of its centre.
 const heads=[{x:-0.5,y:3,z:1.2},{x:0.5,y:3,z:1.2}];
 expect(occupantHeadHit({x:10,y:3,z:1.2},{x:-1,y:0,z:0},heads,60)).toEqual({t:expect.closeTo(9.3,9),index:1});
 // A line through the chest, 0.3 under the head's centre, misses; one out of range does too.
 expect(occupantHeadHit({x:10,y:3,z:0.9},{x:-1,y:0,z:0},heads,60)).toBeUndefined();
 expect(occupantHeadHit({x:10,y:3,z:1.2},{x:-1,y:0,z:0},heads,5)).toBeUndefined();
});
test('a driver steps out to die only once the car is still; the seat, explosions and aircraft keep him in',()=>{
 expect(canPedStepOutCar(1,{x:0,y:0.005,z:0},{x:0,y:0,z:0})).toBe(true);
 expect(canPedStepOutCar(1,{x:0,y:0.02,z:0},{x:0,y:0,z:0})).toBe(false);
 expect(canPedStepOutCar(1,{x:0,y:0,z:0.06},{x:0,y:0,z:0})).toBe(false);
 expect(canPedStepOutCar(1,{x:0,y:0,z:0},{x:0,y:0,z:0.03})).toBe(false);
 expect(dieInCarPlan({explosion:true,aircraft:false,driver:true,canStepOut:true})).toBe('seat');
 expect(dieInCarPlan({explosion:false,aircraft:true,driver:true,canStepOut:true})).toBe('seat');
 expect(dieInCarPlan({explosion:false,aircraft:false,driver:true,canStepOut:true})).toBe('leaveAndDie');
 expect(dieInCarPlan({explosion:false,aircraft:false,driver:false,canStepOut:false})).toBe('seat');
 expect(dieInCarPlan({explosion:false,aircraft:false,driver:true,canStepOut:false})).toBe('wait');
});
