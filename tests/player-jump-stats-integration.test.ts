import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {nativeBodyMovementModifier} from '../src/simulation/nativeBodyMovement';
import reference from './fixtures/player-jump-stats-reference.json';

let sim:Simulation;beforeAll(async()=>RAPIER.init());afterEach(()=>sim?.dispose());
const controls={x:0,y:0,cameraYaw:0,sprint:false,jump:false};
for(const [fat,muscle] of [[0,0],[1000,1000]])for(const associations of [{},{run:.5},{sprint:1}])test(`captured jump impulse reaches physical player: ${fat}/${muscle}, ${JSON.stringify(associations)}`,()=>{
 sim=new Simulation();sim.respawn={x:0,y:.03,z:0};sim.resetPlayer();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,-.5,0));sim.world.step();
 for(let i=0;i<20;i++)sim.step(1/60,controls);expect(sim.player.grounded).toBe(true);sim.player.heading=0;
 let calls=0;sim.playerBodyMovementModifier=()=>{calls++;return nativeBodyMovementModifier(fat,muscle);};
 const row=reference.launches.find(r=>r.input.fat===fat&&r.input.muscle===muscle&&r.input.player&&!r.input.megaJump&&!r.input.climbJump&&r.input.run===(associations.run??null)&&r.input.sprint===(associations.sprint??null))!;
 expect(row).toBeDefined();sim.step(1/60,{...controls,jump:true,moveAssociations:associations});
 expect(sim.player.grounded).toBe(false);expect(sim.player.verticalSpeed).toBeCloseTo(row.velocity[2]*50-20/60,6);
 expect(sim.player.jumpMomentum.z).toBe(row.velocity[1]*50);expect(calls).toBe(1);
 for(let i=0;i<3;i++)sim.step(1/60,controls);expect(calls).toBe(1);
});
