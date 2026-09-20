import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {readHandling} from '../src/assets/handling';
import {indexFlyingHandling} from '../src/assets/flyingHandling';
import {planeFlight} from '../src/simulation/planeFlight';
import {Quaternion,Vector3} from 'three';
const flight=indexFlyingHandling(readHandling(readFileSync('public/play/world/files/vehicles/handling.cfg','utf8')).supplements).get('DODO')!;
const q={x:0,y:0,z:0,w:1},idle={throttle:0,pitch:0,roll:0,rudder:0,brake:false};
test('retracted drag uses each original aircraft gear coefficient',()=>{
 const profiles=indexFlyingHandling(readHandling(readFileSync('public/play/world/files/vehicles/handling.cfg','utf8')).supplements);
 for(const name of ['RUSTLER','BEAGLE','CROPDUST','STUNT','SHAMAL','NEVADA','DODO']){
  const profile=profiles.get(name)!,v={x:0,y:0,z:-40};
  const down=planeFlight(v,q,idle,profile,false,false),up=planeFlight(v,q,idle,profile,true,false);
  expect(up.acceleration.z/down.acceleration.z).toBeCloseTo(profile.values.gearUpResistance,8);
 }
});
test('unpowered stalled aircraft falls; throttle supplies forward thrust, braking opposes taxi motion',()=>{
 const rest=planeFlight({x:0,y:0,z:0},q,idle,flight,false,false);expect(rest.acceleration.y).toBeLessThan(-9);expect(rest.stall).toBe(true);
 expect(planeFlight({x:0,y:0,z:0},q,{...idle,throttle:1},flight,false,true).acceleration.z).toBeLessThan(0);
 const v={x:0,y:0,z:-12};expect(planeFlight(v,q,{...idle,brake:true},flight,false,true).acceleration.z).toBeGreaterThan(planeFlight(v,q,idle,flight,false,true).acceleration.z);
});
test('banked turns are identical at every compass heading and mirrored for opposite banks',()=>{
 for(const bank of [-.5,.5]){
  let reference:number|undefined;
  for(const heading of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
   const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),heading)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),bank));
   const velocity=new Vector3(0,0,-35).applyQuaternion(rotation);
   const result=planeFlight(velocity,rotation,idle,flight,true,false);
   expect(Math.sign(result.angular.y)).toBe(Math.sign(bank));
   reference??=result.angular.y;expect(result.angular.y).toBeCloseTo(reference,10);
   expect(planeFlight(velocity,rotation,idle,flight,false,true).angular.length()).toBe(0);
  }
 }
});
test('vertical flight has no undefined bank turn',()=>{
 const rotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2);
 const result=planeFlight(new Vector3(0,0,-35).applyQuaternion(rotation),rotation,idle,flight,true,false);
 expect(result.angular.length()).toBe(0);expect(Number.isFinite(result.acceleration.length())).toBe(true);
});
test('flight controls have no aerodynamic authority at rest and bank right with the right wing down',()=>{
 expect(planeFlight({x:0,y:0,z:0},q,{...idle,pitch:1,roll:1},flight,false,true).angular.length()).toBe(0);
 const air=planeFlight({x:0,y:0,z:-35},q,{...idle,pitch:1,roll:1},flight,true,false);expect(air.angular.x).toBeGreaterThan(0);expect(air.angular.z).toBeLessThan(0);expect(air.stall).toBe(false);
});

import { heightAboveCeiling } from '../src/simulation/WorldPlane';
test('CVehicle::HeightAboveCeiling: 800 m for aircraft, the Baron\'s 500 m with its 950 to 1500 m band', () => {
  expect(heightAboveCeiling(799, 'aircraft')).toBe(-1);
  expect(heightAboveCeiling(850, 'aircraft')).toBe(50);
  expect(heightAboveCeiling(499, 'baron')).toBe(-1);
  expect(heightAboveCeiling(600, 'baron')).toBe(100);
  expect(heightAboveCeiling(1000, 'baron')).toBe(-1);
  expect(heightAboveCeiling(1600, 'baron')).toBe(1100);
});
