import {test,expect} from '@playwright/test';

test('a bullet into a body done dying plays FLOOR_HIT and counts as a hit, not before',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:3,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const p=crowd.people.find((p:any)=>!p.officer&&p.health>0);if(!p)throw new Error('no ped');
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();p.view.update(p.actor,1/60);};
   for(let i=0;i<10;i++)tick();
   crowd.damageCollider(p.collider.handle,1000,{x:0,z:1});tick();
   const death=p.view.reactionName;
   const early=crowd.damageCollider(p.collider.handle,30,{x:0,z:1});
   for(let i=0;i<60*4;i++)tick();
   const late=crowd.damageCollider(p.collider.handle,30,{x:0,z:1});
   const blast=crowd.damageCollider(p.collider.handle,30,{x:0,z:1},'explosion');
   return {death,early,late,blast,reaction:p.view.reactionName,health:p.health};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.death).toBeTruthy();expect(result.health).toBe(0);
 // Still in CTaskSimpleDie: nothing.
 expect(result.early).toBe(false);
 // TASK_SIMPLE_DEAD: the floor hit, on the side the death clip left the body.
 expect(result.late).toBe(true);expect(result.reaction).toMatch(/^floor_hit(_f)?$/);
 // Blasts do not come through GenerateDamageEvent.
 expect(result.blast).toBe(false);
});
