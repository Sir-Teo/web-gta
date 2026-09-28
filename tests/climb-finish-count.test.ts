import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {CLIMB} from '../src/ped/nativeClimb';

beforeAll(async()=>{await RAPIER.init();});

// CTaskSimpleClimb::StartAnim's CLIMB_FINISHED and FINISHED_V blend IDLE in at 1000 and zero the move ratio; the
// simulation counts those finishes so the renderer resets its move anims then. An abort, which drops back to the
// in-air task, does not count.
const finish=(heightForAnim:number,standing:boolean)=>{
  const sim=new Simulation();
  try{
    sim.respawn={x:0,y:.03,z:0};sim.resetPlayer();
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,-.5,0));sim.world.step();
    const c={x:0,y:0,cameraYaw:0,sprint:false,jump:false,handbrake:false} as any;
    for(let i=0;i<5;i++)sim.step(1/60,c);
    (sim as any).climbWorld={};
    (sim as any).climb={updateAnim(){},abort(){},process:()=>true,finished:true,standing,invalid:false,heightForAnim,heightForPos:heightForAnim};
    sim.step(1/60,c);
    return {count:sim.climbsFinished,climbing:sim.climbing};
  }finally{sim.dispose();}
};
test('a climb that stands up or vaults counts as finished; an abort does not',()=>{
  expect(finish(CLIMB.FINISHED,true)).toEqual({count:1,climbing:false});
  expect(finish(CLIMB.FINISHED_V,false)).toEqual({count:1,climbing:false});
  expect(finish(CLIMB.PULLUP,false)).toEqual({count:0,climbing:false});
});
