import {describe,expect,it} from 'vitest';
import {PED_CAR_KILL_INTENSITY,carHitsPed,killPedWithCarTask,type KillPedWithCarInput} from '../src/combat/nativeCarPedHit';
import {PED_PIECE,WEAPON} from '../src/combat/nativeDamageAnim';

const zero={x:0,y:0,z:0};
/** A 1500 kg car driving along +y into a ped standing ahead of its centre of mass. */
const car=(speed:number)=>({mass:1500,turnMass:4000,elasticity:.05,offset:{x:0,y:2,z:0},moveSpeed:{x:0,y:speed,z:0},turnSpeed:zero});
const towardCar={x:0,y:-1,z:0};

describe('CPhysical::ApplyCollision against a ped',()=>{
 it('counts the car ten times heavier, so the ped takes the impact',()=>{
  const hit=carHitsPed(car(.2),zero,towardCar)!;
  const carMass=15000,common=carMass*-.2/(carMass+70);
  expect(hit.pedIntensity).toBeCloseTo(-(common*1.05*70),9);
  expect(hit.pedForce.y).toBeCloseTo(hit.pedIntensity,9);
  // The car's force is divided by the factor again: it barely slows.
  expect(Math.abs(hit.vehicleForce.y)/1500).toBeLessThan(.001);
 });
 it('crosses the kill intensity at about 8 m/s of closing speed',()=>{
  expect(carHitsPed(car(.2),zero,towardCar)!.pedIntensity).toBeGreaterThan(PED_CAR_KILL_INTENSITY);
  expect(carHitsPed(car(.14),zero,towardCar)!.pedIntensity).toBeLessThan(PED_CAR_KILL_INTENSITY);
 });
 it('includes the ped walking into the car',()=>{
  const still=carHitsPed(car(.1),zero,towardCar)!,walking=carHitsPed(car(.1),{x:0,y:-.03,z:0},towardCar)!;
  expect(walking.pedIntensity).toBeGreaterThan(still.pedIntensity);
 });
 it('ignores a car moving away',()=>{
  expect(carHitsPed(car(-.2),zero,towardCar)).toBeUndefined();
 });
 it('never pushes the ped down into the ground',()=>{
  const hit=carHitsPed(car(.2),zero,{x:0,y:-.8,z:.6})!;
  expect(hit.pedForce.z).toBe(0);
 });
});

describe('CTaskSimpleKillPedWithCar::ProcessPed',()=>{
 const base:KillPedWithCarInput={carPosition:zero,right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},
  boundsMin:{x:-1,y:-2.5,z:-.5},boundsMax:{x:1,y:2.5,z:1},carMoveSpeed:{x:0,y:.2,z:0},carMass:1500,pedPosition:zero,pedHitSide:0};
 it('throws a ped standing ahead onto the bonnet',()=>{
  const out=killPedWithCarTask({...base,pedPosition:{x:0,y:3,z:.4}});
  expect(out).toMatchObject({weapon:WEAPON.rammedByCar,pedPiece:PED_PIECE.ass,knockedUpIntoAir:true,onBonnet:true,crunch:false,damage:1000});
  // Level car: t = (bbox top - ped z) / (front / speed).
  expect(out.pedMoveSpeed.y).toBeCloseTo((1-.4)/(2.5/.2),9);
  // Pushed back along the line to the ped, scaled by min(1, mass / 1400).
  expect(Math.hypot(out.vehicleForce.x,out.vehicleForce.y,out.vehicleForce.z)).toBeCloseTo(100,9);
  expect(out.vehicleForce.y).toBeLessThan(0);
 });
 it('runs over a ped beside the wheels and turns a side hit into a front one',()=>{
  const out=killPedWithCarTask({...base,pedPosition:{x:1.5,y:0,z:0},pedHitSide:3});
  expect(out).toMatchObject({weapon:WEAPON.runOverByCar,pedPiece:PED_PIECE.rightArm,direction:0,crunch:true,knockedUpIntoAir:false});
  expect(out.pedMoveSpeed).toEqual({x:0,y:.2*.9,z:0});
 });
 it('rams a ped beside the rear of the car without running it over',()=>{
  const out=killPedWithCarTask({...base,pedPosition:{x:-1.5,y:2.3,z:0},pedHitSide:1});
  expect(out).toMatchObject({weapon:WEAPON.rammedByCar,pedPiece:PED_PIECE.leftArm,direction:1,crunch:false});
 });
 it('drags a low ped under the front',()=>{
  const out=killPedWithCarTask({...base,pedPosition:{x:0,y:3,z:-.2}});
  expect(out).toMatchObject({weapon:WEAPON.rammedByCar,pedPiece:PED_PIECE.ass,crunch:true,onBonnet:false});
 });
 it('scales the push back for light vehicles',()=>{
  const out=killPedWithCarTask({...base,carMass:700,pedPosition:{x:0,y:3,z:.4}});
  expect(Math.hypot(out.vehicleForce.x,out.vehicleForce.y,out.vehicleForce.z)).toBeCloseTo(50,9);
 });
});
