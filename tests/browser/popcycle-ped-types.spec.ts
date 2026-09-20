import {test,expect} from '@playwright/test';

test('street spawns follow the popcycle ped targets: gang deficits make gang parties, other-only zones make civilians',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const run=async(targets:any)=>{
   const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
   crowd.gangTurf=()=>({gang:0,strength:255});crowd.gangsNeeded=()=>1;crowd.pedTargets=()=>targets;
   try{
    for(let i=0;i<300&&crowd.snapshot().people.length<6;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
    const people=crowd.snapshot().people.filter((p:any)=>!p.officer);
    return {count:people.length,gang:people.filter((p:any)=>p.gang===0).length,civilians:people.filter((p:any)=>p.gang===undefined).length};
   }finally{crowd.dispose();}
  };
  try{
   const strengths=[255,...Array(9).fill(0)];
   const gangs=await run({dealers:0,gangs:12,cops:0,other:0,gangStrengths:strengths});
   const civilians=await run({dealers:0,gangs:0,cops:0,other:12,gangStrengths:strengths});
   return {gangs,civilians};
  }finally{sim.dispose();}
 });
 expect(result.gangs.count).toBeGreaterThan(0);
 expect(result.gangs.civilians).toBe(0);
 expect(result.gangs.gang).toBe(result.gangs.count);
 expect(result.civilians.count).toBeGreaterThan(0);
 expect(result.civilians.gang).toBe(0);
});
