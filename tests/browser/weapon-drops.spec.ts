import {test,expect} from '@playwright/test';

test('dead armed peds report their gun with leftover rounds',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem());
  try{
   for(let i=0;i<300;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,10));}
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   for(let i=0;i<30;i++)tick();
   const drops:{weapon:number;rounds:number}[]=[];
   crowd.onDropWeapon=(_position:{x:number;y:number;z:number},weapon:number,rounds:number)=>{drops.push({weapon,rounds});};
   await crowd.spawnOfficer('lapd1',22,{x:2490,y:13,z:1680},0);
   for(let i=0;i<30;i++)tick();
   const off=crowd.snapshot().people.find((p:any)=>p.officer);
   if(!off)throw new Error('No officer');
   const target=crowd.targets().find((t:{position:{x:number;z:number}})=>Math.hypot(t.position.x-off.position.x,t.position.z-off.position.z)<0.5);
   if(!target)throw new Error('No officer target');
   crowd.damageCollider(target.handle,500,{x:0,z:1},'bullet');
   for(let i=0;i<10;i++)tick();
   // A second sweep reports nothing new.
   for(let i=0;i<10;i++)tick();
   return {drops,dead:crowd.snapshot().people.find((p:any)=>p.officer)?.state};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.drops).toHaveLength(1);
 expect(result.drops[0].weapon).toBe(22);
 expect(result.drops[0].rounds).toBeGreaterThan(0);
 expect(result.dead).toBe('dead');
});
