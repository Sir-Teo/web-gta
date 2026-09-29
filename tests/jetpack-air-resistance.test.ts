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
