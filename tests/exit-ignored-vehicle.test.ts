import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>{await RAPIER.init();});

// CTaskSimpleCarJumpOut's m_pEntityIgnoredCollision: the vehicle the player leaves from its seat is not met by his sweep
// or the solver until his capsule is clear of it; then the pair is let go.
test('the vehicle just left is ignored until the player is clear of it',()=>{
  const sim=new Simulation();
  try{
    sim.respawn={x:0,y:.03,z:0};sim.resetPlayer();
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,-.5,0));
    const bike=sim.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(.3,.6,0));
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.3,.5,1),bike);sim.world.step();
    sim.ignoreVehicleOnExit(bike);
    const controls={x:0,y:0,cameraYaw:0,sprint:false,jump:false,handbrake:false};
    for(let i=0;i<10;i++){sim.step(1/60,controls);}
    // Still overlapping: still ignored, and the bike was not shoved off by the capsule.
    expect(sim.ignoredBodyPairs.size).toBe(1);
    expect(bike.translation().x).toBeLessThan(.4);
    bike.setTranslation({x:6,y:.6,z:0},true);bike.setLinvel({x:0,y:0,z:0},true);
    for(let i=0;i<3;i++)sim.step(1/60,controls);
    expect(sim.ignoredBodyPairs.size).toBe(0);
    expect(sim.playerCollider.activeHooks()).toBe(RAPIER.ActiveHooks.NONE);
  }finally{sim.dispose();}
});
