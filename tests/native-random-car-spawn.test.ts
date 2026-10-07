import {expect,test} from 'vitest';
import {approachesPlayer,clampCreationT,laneCountAllows,nodeSpeedCode,nodeSpeedMultiplier,speedMultiplierFromNodes,randomCarCreationBearing,randomCarCruiseSpeed,spawnProbabilityPasses} from '../src/vehicle/nativeRandomCarSpawn';

test('the bearing: any from a camera looking down, the car\'s way when driving, the camera\'s on foot',()=>{
 const view={cameraForwardZ:0,cameraFront:{x:0,y:1}};
 expect(randomCarCreationBearing({...view,cameraForwardZ:-.95,frameCounter:0})).toEqual({dirX:.707,dirY:.707,minDot:-1,dotAbove:true});
 const fast={...view,vehicleVelocity:{x:.6,y:0}};
 expect([0,1,2,3].map(frameCounter=>randomCarCreationBearing({...fast,frameCounter}))).toEqual([
  {dirX:1,dirY:0,minDot:.85,dotAbove:true},{dirX:1,dirY:0,minDot:.85,dotAbove:true},{dirX:1,dirY:0,minDot:.707,dotAbove:true},{dirX:1,dirY:0,minDot:.707,dotAbove:false}]);
 const slow={...view,vehicleVelocity:{x:0,y:-.2}};
 expect([0,1,2,3].map(frameCounter=>randomCarCreationBearing({...slow,frameCounter}).minDot)).toEqual([.85,.707,.707,.707]);
 expect([0,1,2,3].map(frameCounter=>randomCarCreationBearing({...slow,frameCounter}).dotAbove)).toEqual([true,true,false,false]);
 // Standing (or crawling) the camera's way: inside the cone on even frames, outside it on odd ones.
 expect(randomCarCreationBearing({...view,vehicleVelocity:{x:.05,y:0},frameCounter:1})).toEqual({dirX:0,dirY:1,minDot:.707,dotAbove:false});
});

test('spawn probability, lanes, cruise and the place along the link',()=>{
 expect(spawnProbabilityPasses(0x13,15,3)).toBe(true);expect(spawnProbabilityPasses(0x14,15,3)).toBe(false);
 expect(spawnProbabilityPasses(0x10,0,0)).toBe(true);expect(spawnProbabilityPasses(1,0,9)).toBe(false);
 expect(laneCountAllows(0,400,false)).toBe(false);expect(laneCountAllows(2,481,true)).toBe(false);expect(laneCountAllows(1,481,true)).toBe(true);
 expect(laneCountAllows(1,431,false)).toBe(false);expect(laneCountAllows(2,437,false)).toBe(true);
 expect(randomCarCruiseSpeed(0,4,400,false)).toBe(13);expect(randomCarCruiseSpeed(0x70000000,4,400,false)).toBe(20);
 // rand()'s very top rounds to 1.0 in float, as the executable's conversion does: 21.
 expect(randomCarCruiseSpeed(0x7fffffff,4,400,false)).toBe(21);
 expect(randomCarCruiseSpeed(0x70000000,12,400,false)).toBe(15);expect(randomCarCruiseSpeed(0x70000000,4,531,false)).toBe(6);
 expect(clampCreationT(.01,5,20)).toBeCloseTo(3.5/20,6);expect(clampCreationT(.99,5,20)).toBeCloseTo(1-3.5/20,6);expect(clampCreationT(.4,5,6)).toBe(.5);
 expect(nodeSpeedMultiplier(0)).toBe(.65);expect(nodeSpeedMultiplier(0x2000)).toBe(2.3);
 // PickNextNodeAccordingStrategy: a reached node of behaviour type 8 or 9 gives code −1 (0.5); GenerateOneRandomCar
 // reads bits 12 and 13 alone.
 expect(nodeSpeedCode(0x801000)).toBe(-1);expect(nodeSpeedCode(0x801000,false)).toBe(1);expect(nodeSpeedCode(0x1000)).toBe(1);
 expect([-1,0,1,2,3].map(speedMultiplierFromNodes)).toEqual([.5,.65,1,2.3,1]);
});

test('a car must be closing on the player, his own speed taken off',()=>{
 expect(approachesPlayer({x:-1,y:0},{x:0,y:0},{x:30,y:0},{x:0,y:0})).toBe(true);
 expect(approachesPlayer({x:1,y:0},{x:0,y:0},{x:30,y:0},{x:0,y:0})).toBe(false);
 // Driving away from it faster than it comes: it is closing.
 expect(approachesPlayer({x:.5,y:0},{x:1,y:0},{x:30,y:0},{x:0,y:0})).toBe(true);
});
