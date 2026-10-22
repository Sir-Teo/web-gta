import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {NATIVE_PED_AIR_RESISTANCE} from '../src/simulation/nativePlayerLocomotion';
beforeAll(async()=>{await RAPIER.init();});
// CPhysical::ProcessControl's ApplyAirResistance (the ped's 1/175) runs on the flier before CTaskSimpleJetPack's own
// 0.02 damping in ProcessThrust.
test('the jetpack flier loses the ped air resistance on top of the pack damping',()=>{
 const sim=new Simulation();
 try{
  sim.player.position={x:0,y:60,z:0};sim.player.grounded=false;sim.playerBody.setTranslation({x:0,y:60.9,z:0},true);
  sim.startJetPack();(sim as any).jetVelocity={x:.4,y:0,z:0};
  const dt=1/50;sim.step(dt,{x:0,y:0,jump:false,sprint:false,cameraYaw:0} as any);
  const v=(sim as any).jetVelocity,ts=dt*50;
  const resisted=.4*Math.pow(1-.4*NATIVE_PED_AIR_RESISTANCE,ts),packOnly=.4*Math.pow(1-.4*.02,ts),both=resisted*Math.pow(1-resisted*.02,ts);
  expect(v.x).toBeLessThan(packOnly);expect(v.x).toBeCloseTo(both,4);
 }finally{sim.dispose();}
});

test('jetpack ascent and braking are independent of the forward/backward tilt axis',()=>{
 const frame=(y:number,accelerate=false,brake=false)=>{const sim=new Simulation();try{sim.player.position={x:0,y:60,z:0};sim.player.grounded=false;sim.playerBody.setTranslation({x:0,y:60.9,z:0},true);sim.startJetPack();sim.step(1/50,{x:0,y,jump:false,sprint:false,cameraYaw:0,jetPackInput:{accelerate,brake}});return {thrust:sim.jetPack!.thrustFwd,angle:sim.jetPack!.thrustAngle,vz:sim.player.verticalSpeed};}finally{sim.dispose();}};
 const coasting=frame(0),ascending=frame(0,true),descending=frame(0,false,true),backwards=frame(-1);
 expect(coasting.thrust).toBe(0);expect(ascending.thrust).toBe(1);expect(ascending.angle).toBe(0);expect(ascending.vz).toBeGreaterThan(0);expect(descending.thrust).toBe(-1);expect(descending.vz).toBeLessThan(coasting.vz);expect(backwards.thrust).toBe(1);expect(backwards.angle).toBeGreaterThan(0);
});
