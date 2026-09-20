import {expect,test} from 'vitest';
import {raySphere,seatedPedHit,canPedStepOutCar,dieInCarPlan,SEATED_PED_SPHERE_OFFSETS,DIE_IN_CAR_OFFSET_MS} from '../src/vehicle/nativeDieInCar';
test('a bullet line reaches the seated ped through its three 0.35 spheres',()=>{
 expect(SEATED_PED_SPHERE_OFFSETS).toEqual([-0.2,0.2,0.6]);expect(DIE_IN_CAR_OFFSET_MS).toBe(2000);
 expect(raySphere({x:0,y:0,z:0},{x:1,y:0,z:0},{x:5,y:0,z:0},.35)).toBeCloseTo(4.65,9);
 expect(raySphere({x:0,y:0,z:0},{x:1,y:0,z:0},{x:5,y:1,z:0},.35)).toBeUndefined();
 expect(raySphere({x:5,y:0,z:0},{x:1,y:0,z:0},{x:5,y:0,z:0},.35)).toBe(0);
 const seat={x:0,y:3,z:0.5},centers=SEATED_PED_SPHERE_OFFSETS.map(z=>({x:seat.x,y:seat.y,z:seat.z+z}));
 // Aimed at the head sphere from 10 units off the side; the leg sphere is out of the line.
 expect(seatedPedHit({x:10,y:3,z:1.1},{x:-1,y:0,z:0},centers,60)).toBeCloseTo(9.65,9);
 expect(seatedPedHit({x:10,y:3,z:2},{x:-1,y:0,z:0},centers,60)).toBeUndefined();
 expect(seatedPedHit({x:10,y:3,z:1.1},{x:-1,y:0,z:0},centers,5)).toBeUndefined();
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
