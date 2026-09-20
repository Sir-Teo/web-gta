import {test,expect} from '@playwright/test';

test('a jacked driver draws his decision: a kill answer becomes the steal-the-car-back sequence or a flee from an armed jacker; flee and steal draws leave him to walk off',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{WorldFleet},{loadWorldRoadMaterials},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/WorldFleet.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(2490,12,1680));
  sim.respawn={x:2500,y:12.55,z:1690};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base) as any;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:0,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&(!fleet.catalog||!crowd.snapshot().ready);i++){fleet.update(i*100);crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const car=await fleet.spawnTrafficCar(492,{x:2490,y:12.5,z:1680},0);
   const carPos=()=>{const t=car.car.body.translation();return {x:t.x,y:t.y,z:t.z};};
   const tick=()=>{crowd.update(performance.now());crowd.beforeStep(1/60,[car]);car.beforeStep(1/60,{x:0,y:0},false);sim.world.step();car.afterStep(1/60);crowd.afterStep();for(const p of crowd.people)p.view.update(p.actor,1);};
   for(let i=0;i<30;i++){tick();if(i%10===0)await new Promise(r=>setTimeout(r,30));}
   crowd.decisionMakerOf=()=>2;crowd.playerArmed=()=>false;
   let seq:number[]=[];crowd.jackedRandom=()=>seq.shift()??.5;
   const spawn=async(draws:number[])=>{seq=draws;const before=crowd.people.length;crowd.spawnJacked(0,{x:2490,y:12.55,z:1688},0,undefined,{position:carPos});
    for(let i=0;i<20&&crowd.people.length===before;i++){tick();await new Promise(r=>setTimeout(r,30));}
    const p=crowd.people[crowd.people.length-1];if(crowd.people.length===before)throw new Error('no ped');return p;};
   const run=(p:any,frames:number)=>{const phases:string[]=[];let fist=false;for(let i=0;i<frames;i++){tick();const ph=p.stealBack?.phase??'done';if(phases[phases.length-1]!==ph)phases.push(ph);if(p.view.reactionName==='fucku')fist=true;if(ph==='done'&&phases.length>1)break;}
    const c=carPos();return {phases,fist,dist:Math.hypot(p.actor.player.position.x-c.x,p.actor.player.position.z-c.z),flee:p.flee,safe:p.fleePlayer?.safe??null};};
   // A kill draw (.05) with the coin at .7: face the jacker, shake a fist, then run at the car.
   const fist=await spawn([.05,.7]);const fistRun=run(fist,900);
   // A kill draw with the coin at .2: a pause of 0.5 to 1.5 s, then the run.
   const pause=await spawn([.05,.2,.5]);const pauseRun=run(pause,900);
   // Flee (.5) and steal (.9) draws leave no task; the ped stands free with no flight.
   const fleeDraw=await spawn([.5]);const stealDraw=await spawn([.9]);for(let i=0;i<30;i++)tick();
   const noTask={flee:{stealBack:fleeDraw.stealBack?.phase??null,flee:fleeDraw.flee,fleePlayer:!!fleeDraw.fleePlayer},steal:{stealBack:stealDraw.stealBack?.phase??null,flee:stealDraw.flee,fleePlayer:!!stealDraw.fleePlayer}};
   // An armed jacker: the kill is not appropriate, so the victim flees the player for good.
   crowd.playerArmed=()=>true;const scared=await spawn([.05]);for(let i=0;i<5;i++)tick();
   const armed={stealBack:scared.stealBack?.phase??null,flee:scared.flee,safe:scared.fleePlayer?.safe??null};
   return {fistRun,pauseRun,noTask,armed};
  }finally{crowd.dispose();fleet.dispose();sim.dispose();}
 });
 expect(result.fistRun.phases).toEqual(['face','shake','go','done']);expect(result.fistRun.fist).toBe(true);
 expect(result.fistRun.dist).toBeLessThan(4.5);expect(result.fistRun.flee).toBe(0);
 expect(result.pauseRun.phases).toEqual(['pause','go','done']);expect(result.pauseRun.fist).toBe(false);expect(result.pauseRun.dist).toBeLessThan(4.5);
 expect(result.noTask.flee).toEqual({stealBack:null,flee:0,fleePlayer:false});expect(result.noTask.steal).toEqual({stealBack:null,flee:0,fleePlayer:false});
 expect(result.armed.stealBack).toBeNull();expect(result.armed.flee).toBeGreaterThan(100);expect(result.armed.safe).toBe(100000);
});
