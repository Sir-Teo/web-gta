import {describe,expect,it,test} from 'vitest';
import {limitRadarPoint,radarNorth,radarPoint,radarRange} from '../src/ui/nativeRadar';

describe('CRadar::DrawMap range',()=>{
 it('shows 180 units on foot and widens from 180 to 350 with vehicle speed',()=>{
  expect(radarRange({inVehicle:false})).toBe(180);
  expect(radarRange({inVehicle:true,speed:.2})).toBe(180);
  expect(radarRange({inVehicle:true,speed:.6})).toBeCloseTo(265,6);
  expect(radarRange({inVehicle:true,speed:1})).toBe(350);
 });
 it('scales with altitude in a plane',()=>{
  expect(radarRange({inVehicle:true,plane:true,altitude:10})).toBe(340);
  expect(radarRange({inVehicle:true,plane:true,altitude:500})).toBe(350);
 });
});
describe('radar space',()=>{
 it('puts what the camera faces at the top and north on the rim',()=>{
  // Looking north (heading pi): a point 90 units north is halfway up, east is right.
  const north=radarPoint({x:0,z:-90},Math.PI,180),east=radarPoint({x:90,z:0},Math.PI,180);
  expect(north.u).toBeCloseTo(0,9);expect(north.v).toBeCloseTo(.5,9);expect(east.u).toBeCloseTo(.5,9);expect(east.v).toBeCloseTo(0,9);
  // Looking east (heading pi/2): north is on the left of the rim.
  const n=radarNorth(Math.PI/2,180);expect(n.u).toBeCloseTo(-1,9);expect(n.v).toBeCloseTo(0,9);
  expect(Math.hypot(...Object.values(limitRadarPoint({u:3,v:4})))).toBeCloseTo(1,9);
 });
});

import {blipAlpha} from '../src/ui/NativeMap';
test('CRadar::CalculateBlipAlpha fades with radar distance to no less than 70, wrapping past 6 as the unsigned does',()=>{
 expect([blipAlpha(0),blipAlpha(1),blipAlpha(3),blipAlpha(5)]).toEqual([255,213,128,70]);
 // 255 - 297 as an unsigned, kept to its low byte.
 expect(blipAlpha(7)).toBe(214);
});
