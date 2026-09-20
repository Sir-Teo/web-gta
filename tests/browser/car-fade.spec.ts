import {test,expect} from '@playwright/test';

test('a spawned traffic car starts at clump alpha 0 and fades in 16 a frame',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldFleet},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base) as any;
  try{
   for(let i=0;i<300&&!fleet.catalog;i++){fleet.update(i*100);await new Promise(r=>setTimeout(r,20));}
   const car=await fleet.spawnTrafficCar(492,{x:2500,y:12.5,z:1700},0);
   if(!car)throw new Error('no car');
   const materials=()=>{const out:any[]=[];car.car.root.traverse((o:any)=>{if(o.material)out.push(...(Array.isArray(o.material)?o.material:[o.material]));});return out;};
   const opacities=()=>materials().map((m:any)=>m.opacity);
   const start={alpha:car.alpha,opacity:Math.max(...opacities()),transparent:materials().every((m:any)=>m.transparent)};
   const tick=()=>{car.beforeStep(1/60,{x:0,y:0},false);sim.world.step();car.afterStep(1/60);};
   for(let i=0;i<8;i++)tick();const half={alpha:car.alpha,opacity:Math.max(...opacities())};
   for(let i=0;i<12;i++)tick();
   // Fully faded in, every material is back at its own alpha (glass keeps its 0.4).
   const done={alpha:car.alpha,restored:car.car.materialBindings().every((b:any)=>Math.abs(b.material.opacity-b.source.color[3]/255)<1e-3)};
   return {start,half,done};
  }finally{fleet.dispose();sim.dispose();}
 });
 expect(result.start.alpha).toBe(0);expect(result.start.opacity).toBe(0);expect(result.start.transparent).toBe(true);
 expect(result.half.alpha).toBe(128);expect(result.half.opacity).toBeCloseTo(128/255,2);
 expect(result.done.alpha).toBe(255);expect(result.done.restored).toBe(true);
});
