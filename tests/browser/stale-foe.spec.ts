import {test,expect} from '@playwright/test';

test('a ped forgets the foe of a fight once it is over, and a script kill order keeps its target',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2470,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const law=new WantedSystem(),crowd=new WorldPedestrians(sim,scene,base,()=>undefined,law) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:2,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&crowd.snapshot().people.length<2;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const [a,b]=crowd.people;if(!b)throw new Error('no peds');
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   a.foe=b;a.retaliate=.05;for(let i=0;i<10;i++)tick();
   const ended={foe:a.foe===b,retaliate:a.retaliate};
   a.order={kind:'killPed',foe:b,remaining:30};a.foe=b;a.retaliate=0;tick();
   const ordered=a.foe===b;a.order=undefined;
   return {ended,ordered};
  }finally{crowd.dispose?.();sim.dispose();}
 });
 expect(result.ended).toEqual({foe:false,retaliate:0});
 expect(result.ordered).toBe(true);
});
