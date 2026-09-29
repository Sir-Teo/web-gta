import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>{await RAPIER.init();});

// A landing that kills leaves no FALL_COLLAPSE or KO_SKID_BACK for the respawned player: the death task replaced the
// land task, and RestorePlayerStuffDuringResurrection's SetInitialState starts him afresh.
test('a fatal fall landing does not play after the respawn',()=>{
  const sim=new Simulation();
  try{
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(40,.5,40).setTranslation(0,-.5,0));
    sim.respawn={x:0,y:30,z:0};sim.resetPlayer();sim.world.step();sim.player.health=5;
    const c={x:0,y:0,cameraYaw:0,sprint:false,jump:false,handbrake:false} as any;
    for(let i=0;i<400&&!sim.player.grounded;i++)sim.step(1/50,c);
    expect(sim.player.health).toBe(0);
    expect(sim.fallLanding).toBeDefined();
    sim.respawn={x:5,y:.05,z:5};sim.resetPlayer();
    expect(sim.fallLanding).toBeUndefined();
  }finally{sim.dispose();}
});
