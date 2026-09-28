import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>{await RAPIER.init();});

// CTaskComplexJump and CTaskComplexInAirAndLand own the ped in the air, so PlayerControlZelda does not run and
// m_fMoveBlendRatio stays as the jump left it: a standing jump with the stick pushed mid-flight still lands at 0
// (FALL_LAND), and a running one released mid-flight keeps its ratio (JUMP_LAND).
const jump=(runUp:boolean,inAir:number)=>{
  const sim=new Simulation();
  try{
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(80,.5,80).setTranslation(0,-.5,0));
    sim.respawn={x:0,y:.05,z:0};sim.resetPlayer();sim.world.step();
    const c=(y:number,jump=false)=>({x:0,y,cameraYaw:0,sprint:false,jump,handbrake:false}) as any;
    for(let i=0;i<60;i++)sim.step(1/50,c(runUp?1:0));
    const atLaunch=sim.player.moveBlend;
    sim.step(1/50,c(runUp?1:0,true));
    let airborneBlends:number[]=[];
    for(let i=0;i<40&&!sim.player.grounded||i<3;i++){sim.step(1/50,c(inAir));if(!sim.player.grounded)airborneBlends.push(sim.player.moveBlend);}
    return {atLaunch,airborneBlends};
  }finally{sim.dispose();}
};
test('a standing jump does not build a move ratio in the air',()=>{
  const r=jump(false,1);
  expect(r.atLaunch).toBe(0);
  expect(r.airborneBlends.length).toBeGreaterThan(5);
  expect(Math.max(...r.airborneBlends)).toBe(0);
});
test('a running jump keeps its ratio with the stick released in the air',()=>{
  const r=jump(true,0);
  expect(r.atLaunch).toBeGreaterThan(1.5);
  expect(Math.min(...r.airborneBlends)).toBeCloseTo(r.atLaunch,6);
});
