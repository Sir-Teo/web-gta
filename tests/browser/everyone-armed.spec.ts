import {test,expect} from '@playwright/test';
/** CPopulation::AddPed with CHEAT_EVERYONE_ARMED on: every civilian it makes holds a pistol, a bat, a shotgun, an M4
 * or a rocket launcher; with the cheat off they come unarmed. */
test('with everyone armed, each new civilian takes one of the five weapons',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{CHEATS},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/src/simulation/nativeCheats.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const civilians=async(armed:boolean)=>{
   const sim=new Simulation(),scene=new THREE.Scene();
   sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
   sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
   if(armed)CHEATS.enable('everyoneArmed');else CHEATS.disable('everyoneArmed');
   const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem());
   try{
    const civil=()=>crowd.people.filter((p:any)=>/^CIV(MALE|FEMALE)$/i.test(p.pedType??''));
    for(let i=0;i<300&&civil().length<3;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
    return civil().map((p:any)=>p.weaponType??null);
   }finally{crowd.dispose();sim.dispose();CHEATS.disable('everyoneArmed');}
  };
  return {armed:await civilians(true),plain:await civilians(false)};
 });
 expect(result.armed.length).toBeGreaterThan(0);
 for(const w of result.armed)expect([22,5,25,31,35]).toContain(w);
 expect(result.plain.length).toBeGreaterThan(0);
 for(const w of result.plain)expect(w).toBeNull();
});

test('under the ninja theme every GANG7 member carries the katana',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/models.html');const weapons=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{CHEATS},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/src/simulation/nativeCheats.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  CHEATS.enable('ninja');
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem());
  // GANG7's turf everywhere (gangsNeeded is a mask of the gangs: bit 6).
  crowd.gangTurf=()=>({gang:6,strength:255});crowd.gangsNeeded=()=>1<<6;
  try{
   const members=()=>crowd.people.filter((p:any)=>p.gang===6);
   for(let i=0;i<300&&members().length<2;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   for(let i=0;i<100&&members().some((p:any)=>!p.weapon);i++)await new Promise(r=>setTimeout(r,20));
   return members().map((p:any)=>p.weapon?.info.type??null);
  }finally{crowd.dispose();sim.dispose();CHEATS.disable('ninja');}
 });
 expect(weapons.length).toBeGreaterThan(0);
 for(const w of weapons)expect(w).toBe(8);
});
