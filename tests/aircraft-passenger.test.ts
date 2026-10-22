import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {Simulation} from '../src/simulation/Simulation';
import {WorldPlane} from '../src/simulation/WorldPlane';
beforeAll(async()=>{await RAPIER.init();});
function setup(){
 const sim=new Simulation(),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicVelocityBased().setTranslation(10,50,20));
 // Rendering/assets are outside these real-body occupancy and CWorld after-step checks.
 const plane=Object.assign(Object.create(WorldPlane.prototype),{sim,body,occupied:false,remoteControlled:false,playerPassengerSeat:0,health:1000,canBeDamaged:true,modelId:417,
  recordingSlot:3,heliPilot:{mission:20,destination:[100,200,50]},autopilot:{throttle:.3},airspeed:10,grounded:false,bombTimerMs:0,pendingExplosion:false,impactVelocity:new Vector3(),stepDt:.02})as WorldPlane;
 return{sim,plane,body,dispose:()=>sim.dispose()};
}
test('boarding as a passenger preserves AI and playback ownership and follows the real aircraft body',()=>{
 const f=setup();try{
  const pilot=f.plane.heliPilot,controls=f.plane.autopilot;f.plane.setPlayerInAsPassenger(1);
  expect(f.plane.controlled).toBe(false);expect(f.plane.playersVehicle).toBe(true);expect(f.plane.recordingSlot).toBe(3);expect(f.plane.heliPilot).toBe(pilot);expect(f.plane.autopilot).toBe(controls);
  expect(f.sim.playerCollider.isEnabled()).toBe(false);expect(f.sim.cameraExcludedBody).toBe(f.body);expect(f.sim.player.position).toEqual({x:10,y:50,z:20});
  f.body.setTranslation({x:25,y:60,z:35},true);f.plane.afterStep();
  expect(f.sim.player.position).toEqual({x:25,y:60,z:35});expect(f.sim.player.grounded).toBe(false);expect(f.sim.playerBody.translation().y).toBeCloseTo(60.9,4);
 }finally{f.dispose();}
});
test('a passenger warped out regains collision at the destination while aircraft AI and recording continue',()=>{
 const f=setup();try{
  f.plane.setPlayerInAsPassenger(1);f.plane.setPlayerOutAsPassenger({x:30,y:40,z:50});
  expect(f.plane.playerPassengerSeat).toBe(0);expect(f.plane.occupied).toBe(false);expect(f.plane.recordingSlot).toBe(3);expect(f.plane.heliPilot?.mission).toBe(20);
  expect(f.sim.playerCollider.isEnabled()).toBe(true);expect(f.sim.cameraExcludedBody).toBeUndefined();expect(f.sim.player.position).toEqual({x:30,y:40,z:50});expect(f.sim.player.grounded).toBe(false);
  f.body.setTranslation({x:100,y:100,z:100},true);f.plane.afterStep();expect(f.sim.player.position).toEqual({x:30,y:40,z:50});
 }finally{f.dispose();}
});
test('accepted aircraft destruction kills the player passenger and clears his seat',()=>{
 const f=setup();try{
  f.plane.setPlayerInAsPassenger(1);expect((f.plane as any).destroyed(false)).toBe(true);
  expect(f.plane.wrecked).toBe(true);expect(f.plane.playerPassengerSeat).toBe(0);expect(f.sim.player.health).toBe(0);expect(f.sim.playerCollider.isEnabled()).toBe(true);
 }finally{f.dispose();}
});
