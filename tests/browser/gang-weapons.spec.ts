import {test,expect} from '@playwright/test';

test('a third of a spawned gang party draws one of the gang\'s weapons: a Ballas pistol or Micro SMG',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  const strengths=Array(10).fill(0);strengths[0]=255;
  crowd.canSpawn=()=>true;crowd.gangTurf=()=>({gang:0,strength:255});crowd.gangsNeeded=()=>1;crowd.pedTargets=()=>({dealers:0,gangs:6,cops:0,other:0,gangStrengths:strengths});
  // Member draws: armed (.1) with the second choice (.9), unarmed (.5), armed with the first (.1,.1), then unarmed.
  const seq=[.1,.9,.5,.1,.1,.5,.5,.5,.5,.5,.5,.5];let k=0;crowd.gangWeaponRandom=()=>seq[k++]??.5;
  try{
   for(let i=0;i<400&&crowd.people.filter((p:any)=>p.gang===0).length<3;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const party=crowd.people.filter((p:any)=>p.gang===0);
   return {size:party.length,draws:k,weapons:party.map((p:any)=>p.weapon?.info.type??0)};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.size).toBeGreaterThanOrEqual(3);
 expect(result.weapons.slice(0,3)).toEqual([28,0,22]);
 expect(result.weapons.filter((w:number)=>w).every((w:number)=>w===22||w===28)).toBe(true);
});
