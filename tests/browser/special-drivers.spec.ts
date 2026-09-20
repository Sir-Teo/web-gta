import {test,expect} from '@playwright/test';

test('special cars seat their fixed drivers from the shipped ped archive',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  try{
   for(let i=0;i<300&&!crowd.snapshot().ready;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   if(!crowd.snapshot().ready)throw new Error(JSON.stringify(crowd.snapshot()));
   return {taxi:crowd.specificDriver('taxi',1),cabbieSF:crowd.specificDriver('cabbie',2),stretch:crowd.specificDriver('stretch',1),whoopee:crowd.specificDriver('mrwhoop',1),securicar:crowd.specificDriver('securica',3),pizza:crowd.specificDriver('pizzaboy',1),plain:crowd.specificDriver('greenwoo',1)};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(['bmocd','wmycd1']).toContain(result.taxi);
 expect(['sbmocd','swmocd']).toContain(result.cabbieSF);
 expect(result.stretch).toBe('wmych');
 expect(result.whoopee).toBe('wmoice');
 expect(result.securicar).toBe('wmysgrd');
 expect(result.pizza).toBe('wmypizz');
 expect(result.plain).toBeUndefined();
});
