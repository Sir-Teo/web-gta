import {test,expect} from '@playwright/test';

test('landed fist blows report the unarmed impact hook once per strike',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(150,.5,150).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined);
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   for(let i=0;i<30;i++)tick();
   let hits=0;crowd.onMeleeHit=()=>{hits++;};
   const first=crowd.snapshot().people[0];
   sim.player.position={...first.position,z:first.position.z-1.2};sim.player.heading=0;
   const swung=crowd.punch();
   for(let i=0;i<30;i++)tick();
   return {swung,hits,hp:crowd.snapshot().people[0].health};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.swung).toBe(true);expect(result.hits).toBe(1);expect(result.hp).toBeLessThan(100);
});
