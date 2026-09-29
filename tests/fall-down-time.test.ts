import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
beforeAll(async()=>{await RAPIER.init();});

// CTaskSimpleFall::ProcessPed counts the down time only once the fall clip has finished (m_bIsFinished) and the ped
// is standing or drowning; lofted, the lie waits. The clip itself and the get-up run regardless.
test('the lie waits in the air and counts on the ground; the fall clip and the get-up do not wait',()=>{
 const sim=new Simulation();
 try{
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,-.5,0));
  const controls={x:0,y:0,cameraYaw:0,sprint:false,jump:false,handbrake:false} as any;
  sim.respawn={x:0,y:0,z:0};sim.resetPlayer();sim.world.step();
  // Fall clip 1 s, lie 0.7 s, get-up 0.5 s.
  sim.knockdown=2.2;sim.knockdownLie=.7;sim.knockdownGetUp=.5;
  sim.player.grounded=false;sim.player.swimming=false;
  sim.step(.1,controls);expect(sim.knockdown).toBeCloseTo(2.1,6);expect(sim.knockdownStalled).toBe(false);
  // Into the lie while airborne: the timer stands.
  sim.knockdown=1.1;sim.player.grounded=false;
  sim.step(.1,controls);expect(sim.knockdown).toBeCloseTo(1.1,6);expect(sim.knockdownStalled).toBe(true);
  // Supported: it counts.
  sim.player.grounded=true;sim.step(.1,controls);expect(sim.knockdown).toBeCloseTo(1,6);expect(sim.knockdownStalled).toBe(false);
  // Drowning counts as supported.
  sim.player.grounded=false;sim.player.swimming=true;sim.step(.1,controls);expect(sim.knockdown).toBeCloseTo(.9,6);
  // The get-up never waits.
  sim.player.swimming=false;sim.knockdown=.4;sim.step(.1,controls);expect(sim.knockdown).toBeCloseTo(.3,6);expect(sim.knockdownStalled).toBe(false);
 }finally{sim.dispose();}
});
