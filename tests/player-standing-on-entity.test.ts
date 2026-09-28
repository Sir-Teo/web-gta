import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
beforeAll(async()=>{await RAPIER.init();});

// CPed::m_standingOnEntity: the player on a dynamic body (a car roof) counts; the ground, or standing on nothing, does not.
test('the player stands on an entity only over a dynamic body',()=>{
 const sim=new Simulation();
 try{
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(50,.5,50).setTranslation(0,-.5,0));
  sim.player.position={x:0,y:0,z:0};sim.player.grounded=true;
  expect(sim.playerStandingOnEntity).toBe(false);
  const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(10,.5,0));sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,.5,2),body);sim.world.step();
  sim.player.position={x:10,y:1,z:0};
  expect(sim.playerStandingOnEntity).toBe(true);
  sim.player.grounded=false;expect(sim.playerStandingOnEntity).toBe(false);
 }finally{sim.dispose();}
});
