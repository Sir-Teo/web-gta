import {test,expect} from '@playwright/test';

test('a street ped in deep water floats at the surface, plays the drown clip and dies floating higher',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:6,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const p=crowd.people.find((p:any)=>!p.officer&&p.health>0);if(!p)throw new Error('no ped');
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();p.view.update(p.actor,1);};
   for(let i=0;i<10;i++)tick();
   // Dry land first: no water, nothing happens.
   const dry={drowning:!!p.drowning,y:p.actor.player.position.y};
   // Then water 2 units deep over the floor: the surface is 0.6 above the ped's centre.
   crowd.waterLevel=()=>12.55+2.0;
   const trace:any[]=[];
   for(let i=0;i<600;i++){tick();if(i%60===0)trace.push({i,y:+p.actor.player.position.y.toFixed(2),drowning:!!p.drowning,health:p.health,reaction:p.view.reactionName??null});if(p.health<=0&&i>60)break;}
   const dead={health:p.health,drowned:!!p.drowned};
   for(let i=0;i<120;i++)tick();
   return {dry,trace,dead,floatY:p.actor.player.position.y,water:14.55};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.dry.drowning).toBe(false);
 // Drowning starts, the drown clip plays, and the ped floats with its origin (a unit above the feet) 0.727 under the
 // surface, where 1.1× buoyancy balances gravity.
 expect(result.trace[1].drowning).toBe(true);
 expect(result.trace[1].reaction).toBe('drown');
 expect(Math.abs(result.trace[2].y+1-(result.water-0.727))).toBeLessThan(0.15);
 // The clip ends in death; at 1.8× buoyancy the body's origin then floats 0.056 under the surface.
 expect(result.dead.health).toBe(0);expect(result.dead.drowned).toBe(true);
 expect(Math.abs(result.floatY+1-(result.water-0.056))).toBeLessThan(0.2);
});
