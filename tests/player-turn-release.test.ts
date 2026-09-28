import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>{await RAPIER.init();});

const controls=(x:number)=>({x,y:0,cameraYaw:0,sprint:false,jump:false,handbrake:false}) as any;
const standing=()=>{
  const sim=new Simulation();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(40,.5,40).setTranslation(0,-.5,0));
  sim.respawn={x:0,y:.05,z:0};sim.resetPlayer();sim.world.step();
  for(let i=0;i<10;i++)sim.step(1/50,controls(0));
  return sim;
};
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));

// PlayerControlZelda sets m_fAimingRotation only while the stick is pushed; CPed::CalculateNewVelocity turns the ped
// toward it every frame he is in control. A tap sideways swings CJ all the way round to face it.
test('a tap on the stick turns CJ all the way to face it',()=>{
  const sim=standing();
  try{
    sim.player.heading=0;
    for(let i=0;i<3;i++)sim.step(1/50,controls(1));
    const target=Math.PI/2,afterTap=wrap(sim.player.heading);
    expect(Math.abs(wrap(afterTap-target))).toBeGreaterThan(.3);
    for(let i=0;i<60;i++)sim.step(1/50,controls(0));
    expect(Math.abs(wrap(sim.player.heading-target))).toBeLessThan(1e-3);
  }finally{sim.dispose();}
});

// Something else turning him (an aimed facing, a teleport) replaces the pending turn.
test('an outside heading change drops the pending turn',()=>{
  const sim=standing();
  try{
    sim.player.heading=0;
    for(let i=0;i<3;i++)sim.step(1/50,controls(1));
    sim.player.heading=-1;
    for(let i=0;i<60;i++)sim.step(1/50,controls(0));
    expect(sim.player.heading).toBeCloseTo(-1,6);
  }finally{sim.dispose();}
});
