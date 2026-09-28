import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>{await RAPIER.init();});

// CPed::CheckIfInTheAir: off the ground, the ped is in the air only with no ground within 1.54 below its origin (0.54
// below the feet). A curb's drop is stepped down; a ledge is fallen from.
test('a curb drop is not in the air, a ledge drop is',()=>{
  const at=(drop:number)=>{
    const sim=new Simulation();
    try{
      sim.world.createCollider(RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,-.5,0));
      sim.respawn={x:0,y:drop,z:0};sim.resetPlayer();sim.world.step();
      sim.step(1/60,{x:0,y:0,cameraYaw:0,sprint:false,jump:false,handbrake:false} as any);
      return {inAir:sim.playerInAir,grounded:sim.player.grounded};
    }finally{sim.dispose();}
  };
  const curb=at(.3),ledge=at(2);
  expect(curb.grounded).toBe(false);expect(curb.inAir).toBe(false);
  expect(ledge.grounded).toBe(false);expect(ledge.inAir).toBe(true);
});

// A bail-out high above the ground is in the air from its first step, so the step keeps the speed the exit handed on;
// a set-out beside the vehicle stands.
test('a ride ending above nothing is in the air at once',()=>{
  const at=(height:number)=>{
    const sim=new Simulation();
    try{
      sim.world.createCollider(RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,-.5,0));
      sim.respawn={x:0,y:height,z:0};sim.resetPlayer();sim.world.step();
      sim.player.grounded=false;sim.checkInAirAfterRide();return sim.playerInAir;
    }finally{sim.dispose();}
  };
  expect(at(.1)).toBe(false);
  expect(at(40)).toBe(true);
});
