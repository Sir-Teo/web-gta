import {expect,test} from 'vitest';
import {nativeVehicleGrip,nativeTransmissionCheat,type NativeVehicleGripInput} from '../src/simulation/nativeVehicleGrip';
const input=():NativeVehicleGripInput=>({tractionMultiplier:.8,velocityFrequency:1,physicsStatus:false,acceleration:.01,perfectHandling:false,extraPerfectHandling:false,extraHandlingNitros:false,isPlayerVehicle:true,vortex:false,vortexAccelerationBrakeStatus:0});
test('ordinary and physics-status traction use distinct source formulas',()=>{
  expect(nativeVehicleGrip(input()).traction).toBeCloseTo(.0008,9);
  expect(nativeVehicleGrip({...input(),physicsStatus:true,carTraction:50000}).traction).toBeCloseTo(.001,9);
  expect(nativeVehicleGrip({...input(),velocityFrequency:2}).traction).toBeCloseTo(.0004,9);
  expect(nativeVehicleGrip({...input(),velocityFrequency:2}).acceleration).toBeCloseTo(.01,8);
});
test('player perfect grip differs from additional nonplayer traction and acceleration modifiers',()=>{
  const player=nativeVehicleGrip({...input(),perfectHandling:true});expect(player.traction).toBeCloseTo(.0032,9);expect(player.acceleration).toBeCloseTo(.01,8);
  const npc=nativeVehicleGrip({...input(),perfectHandling:true,isPlayerVehicle:false});expect(npc.traction).toBeCloseTo(.004992,8);expect(npc.acceleration).toBeCloseTo(.0196,8);
  const extra=nativeVehicleGrip({...input(),extraPerfectHandling:true,isPlayerVehicle:false});expect(extra.traction).toBeCloseTo(.00096,9);expect(extra.acceleration).toBeCloseTo(.014,8);
  expect(nativeVehicleGrip({...input(),extraPerfectHandling:true,extraHandlingNitros:true,isPlayerVehicle:false}).traction).toBeCloseTo(.001248,9);
  expect(nativeVehicleGrip({...input(),extraHandlingNitros:true,isPlayerVehicle:false}).traction).toBeCloseTo(.0008,9);
});
test('Vortex boost uses exact zero and does not multiply the perfect-handling factor twice',()=>{
  expect(nativeVehicleGrip({...input(),vortex:true}).traction).toBeCloseTo(.0032,9);
  expect(nativeVehicleGrip({...input(),vortex:true,perfectHandling:true}).traction).toBeCloseTo(.0032,9);
  expect(nativeVehicleGrip({...input(),vortex:true,vortexAccelerationBrakeStatus:.001}).traction).toBeCloseTo(.0008,9);
});
test('negative NOS temperature takes transmission cheat precedence without conflating grip flags',()=>{
  expect(nativeTransmissionCheat(0x80000,-1,true,true)).toBe('nitros');
  expect(nativeTransmissionCheat(0x80000,0,true,false)).toBe('perfect');
  expect(nativeTransmissionCheat(0,-1,false,true)).toBe('perfect');
  expect(nativeTransmissionCheat(0,-1,false,false)).toBe('none');
});
test('invalid status inputs reject without inventing a default car traction',()=>{
  const i=input(),before=structuredClone(i);nativeVehicleGrip(i);expect(i).toEqual(before);
  for(const patch of [{physicsStatus:true},{physicsStatus:true,carTraction:0},{velocityFrequency:0},{tractionMultiplier:-1},{acceleration:NaN}])expect(()=>nativeVehicleGrip({...i,...patch})).toThrow();
  expect(()=>nativeTransmissionCheat(-1,0,false,false)).toThrow();
});
