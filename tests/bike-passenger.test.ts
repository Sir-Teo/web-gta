import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WorldBike} from '../src/simulation/WorldBike';
beforeAll(async()=>{await RAPIER.init();});
function setup(quad=false){
 const sim=new Simulation(),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(10,20,30));body.setEnabled(false);
 const matrix=Array(16).fill(0);matrix[13]=-.5;matrix[14]=.6;
 const bike=Object.assign(Object.create(WorldBike.prototype),{sim,body,occupied:false,playerPassengerSeat:0,health:1000,canBeDamaged:true,modelId:quad?471:461,
  assets:{vehicle:{type:quad?'quad':'bike'},model:{frames:[{name:'ped_backseat',matrix}]}},recordingSlot:3,autopilot:{throttle:.3},pendingExplosion:false,lastCollisionSeconds:Infinity}) as WorldBike;
 return{sim,bike,body,dispose:()=>sim.dispose()};
}
test('pillion occupancy follows the real body without taking the driver controls or recording',()=>{
 const f=setup();try{
  const ai=f.bike.autopilot;f.bike.setPlayerInAsPassenger(1);
  expect(f.bike.occupied).toBe(false);expect(f.bike.playersVehicle).toBe(true);expect(f.bike.autopilot).toBe(ai);expect(f.bike.recordingSlot).toBe(3);
  expect(f.sim.playerCollider.isEnabled()).toBe(false);expect(f.sim.cameraExcludedBody).toBe(f.body);expect(f.sim.player.position).toEqual({x:10,y:20,z:30});
  f.body.setTranslation({x:30,y:40,z:50},true);f.bike.afterStep();expect(f.sim.player.position).toEqual({x:30,y:40,z:50});expect(f.sim.playerBody.translation().y).toBeCloseTo(40.9,4);
  expect(f.bike.maximumPassengers).toBe(1);expect(f.bike.backSeat()).toEqual({x:0,y:-.5,z:.6});
 }finally{f.dispose();}
});
test('a pillion warped out regains collision while the bike keeps its AI and recording',()=>{
 const f=setup(true);try{
  f.bike.setPlayerInAsPassenger(1);f.bike.setPlayerOutAsPassenger({x:5,y:6,z:7});
  expect(f.bike.playerPassengerSeat).toBe(0);expect(f.bike.occupied).toBe(false);expect(f.bike.recordingSlot).toBe(3);expect(f.bike.autopilot?.throttle).toBe(.3);
  expect(f.sim.playerCollider.isEnabled()).toBe(true);expect(f.sim.cameraExcludedBody).toBeUndefined();expect(f.sim.player.grounded).toBe(false);
  f.body.setTranslation({x:100,y:100,z:100},true);f.bike.afterStep();expect(f.sim.player.position).toEqual({x:5,y:6,z:7});
 }finally{f.dispose();}
});
test('a bike with no backseat cannot carry a player passenger',()=>{
 const f=setup();try{f.bike.assets.model.frames.length=0;expect(f.bike.maximumPassengers).toBe(0);}finally{f.dispose();}
});
test.each([false,true])('destruction kills the pillion and clears his seat (quad=%s)',quad=>{
 const f=setup(quad);try{f.bike.setPlayerInAsPassenger(1);f.bike.blowUp();expect(f.bike.wrecked).toBe(true);expect(f.bike.playerPassengerSeat).toBe(0);expect(f.sim.player.health).toBe(0);expect(f.sim.playerCollider.isEnabled()).toBe(true);}finally{f.dispose();}
});
test('native bike and quad jump thresholds differ, including the automobile upper bound',()=>{
 const f=setup(),q=setup(true);try{
  for(const v of [f,q])v.body.setLinvel({x:14,y:0,z:0},true);expect(f.bike.canJumpOut()).toBe(true);expect(q.bike.canJumpOut()).toBe(false);
  q.body.setLinvel({x:16,y:0,z:0},true);expect(q.bike.canJumpOut()).toBe(true);
  for(const v of [f,q])v.body.setLinvel({x:40,y:0,z:0},true);expect(f.bike.canJumpOut()).toBe(true);expect(q.bike.canJumpOut()).toBe(false);
 }finally{f.dispose();q.dispose();}
});
test('an explosion throws the pillion with native momentum while preserving the driver controls',()=>{
 const f=setup();try{
  f.bike.setPlayerInAsPassenger(1);f.bike.throttle=.7;f.bike.steer=.2;
  (f.bike as any).knockOffSpot=()=>({x:10,y:21,z:30});
  expect(f.bike.explosionKnockOff()).toBe(true);expect(f.bike.playerPassengerSeat).toBe(0);expect(f.sim.playerCollider.isEnabled()).toBe(true);
  expect(f.bike.throttle).toBe(.7);expect(f.bike.steer).toBe(.2);expect(f.bike.autopilot?.throttle).toBe(.3);
  expect(f.sim.player.grounded).toBe(false);expect(f.sim.player.verticalSpeed).toBeCloseTo(5*50/70);expect(Math.abs(f.sim.collisionPush.z)).toBeCloseTo(6*50/70);expect(f.sim.exitCarriesSpeed).toBe(true);
 }finally{f.dispose();}
});
