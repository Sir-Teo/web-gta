import {describe,expect,it} from 'vitest';
import {avoidDirection,potentialGetRunOver,vehiclePotentialCollisionResponse,type GetRunOverVehicle} from '../src/ped/nativeGetRunOver';

/** A car at the origin heading +z, 2 units wide and 5 long, at `speed` units per frame. */
const car=(speed:number,extra:Partial<GetRunOverVehicle>={}):GetRunOverVehicle=>({position:{x:0,z:0},height:0,forward:{x:0,z:1},right:{x:1,z:0},boundsMin:{x:-1,y:-2.5},boundsMax:{x:1,y:2.5},forwardSpeed:speed,horn:false,playerDriven:true,...extra});
const respond=(ped:{x:number;z:number},v:GetRunOverVehicle,random01:number,randomInt1000=999)=>vehiclePotentialCollisionResponse({ped,isCop:false,createdByGame:true,vehicle:v,random01,randomInt1000,respondingToRunOver:false,randomRange:(a)=>a});

describe('the Vice City scan standing in for CVehiclePotentialCollisionScanner',()=>{
 it('flags peds ahead that the car reaches within 4 s and within half its width plus 0.5',()=>{
  // 0.2 units per frame is 10 units per second: 40 units of warning, capped by the 11-unit box.
  expect(potentialGetRunOver({x:0,z:10,height:0},car(.2))).toBe(true);
  expect(potentialGetRunOver({x:1.4,z:8,height:0},car(.2))).toBe(true);
  expect(potentialGetRunOver({x:1.6,z:8,height:0},car(.2))).toBe(false);
  expect(potentialGetRunOver({x:0,z:12,height:0},car(.2))).toBe(false);
  // Behind the front already, or too slow to arrive within 4 s.
  expect(potentialGetRunOver({x:0,z:2,height:0},car(.2))).toBe(false);
  expect(potentialGetRunOver({x:0,z:10,height:0},car(.02))).toBe(false);
  expect(potentialGetRunOver({x:0,z:10,height:5},car(.2))).toBe(false);
 });
 it('looks behind a reversing car',()=>{
  expect(potentialGetRunOver({x:0,z:-8,height:0},car(-.2))).toBe(true);
  expect(potentialGetRunOver({x:0,z:8,height:0},car(-.2))).toBe(false);
 });
 it('points the avoid direction out of the path on the ped side',()=>{
  expect(avoidDirection({x:.3,z:5},car(.2)).x).toBe(1);
  expect(avoidDirection({x:-.3,z:5},car(.2)).x).toBe(-1);
 });
});

describe('CEventHandler::ComputeVehiclePotentialCollisionResponse',()=>{
 it('ignores cars at 0.05 units per frame or slower',()=>{
  expect(respond({x:0,z:4},car(.05),0).task).toBe('none');
 });
 it('mostly lets a ped ahead be, unless the horn sounds, then steps aside or dives',()=>{
  // Fast car (over 0.3): horn needed above 0.1, dive at or below 0.05.
  expect(respond({x:0,z:8},car(.4),.5).task).toBe('none');
  expect(respond({x:0,z:8},car(.4),.5,999).task).toBe('none');
  expect(respond({x:0,z:8},car(.4,{horn:true}),.5).task).toBe('evasiveStep');
  expect(respond({x:0,z:8},car(.4),.08).task).toBe('evasiveStep');
  expect(respond({x:0,z:8},car(.4),.04).task).toBe('evasiveDive');
 });
 it('beside the car steps away or shakes a fist, and in its footprint raises hands or dives',()=>{
  // The ped is just behind the car's middle, 1.5 units out: beyond 1 - 0.175.
  expect(respond({x:1.5,z:-.5},car(.4),.5).task).toBe('evasiveStep');
  expect(respond({x:1.5,z:-.5},car(.4),.05)).toEqual({task:'shakeFist',face:true});
  expect(respond({x:.2,z:-1},car(.4),.1).task).toBe('handsUp');
  expect(respond({x:.2,z:-1},car(.4),.5).task).toBe('evasiveDive');
 });
 it('beyond 2 s of travel, a honking player sends some peds running, fists shaking or heads turning',()=>{
  const far={x:0,z:30};
  expect(respond(far,car(.2,{horn:true}),.5,10)).toEqual({task:'flee',seconds:.75});
  expect(respond(far,car(.2,{horn:true}),.5,50)).toEqual({task:'shakeFist',face:true});
  expect(respond(far,car(.2,{horn:true}),.5,150).task).toBe('face');
  expect(respond(far,car(.2,{horn:true}),.5,500).task).toBe('none');
  expect(respond(far,car(.2),.5,10).task).toBe('none');
 });
});
