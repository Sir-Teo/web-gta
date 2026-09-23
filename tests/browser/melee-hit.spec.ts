import {test,expect} from '@playwright/test';

test('landed fist blows report the unarmed impact hook once per strike',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WeaponSystem},{openWeaponAssets},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/weapons/WeaponSystem.ts','/src/weapons/assets.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined);
  const weapons=new WeaponSystem(sim,()=>crowd,()=>undefined);
  weapons.inventory.installNative(await (await openWeaponAssets(base)).weaponData());
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const tick=()=>{weapons.tick(1/60);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   for(let i=0;i<30;i++)tick();
   // Only the player's blows: the struck ped's decision maker may answer with a kill task and hit back.
   let hits=0;crowd.onMeleeHit=(_at:unknown,byPlayer:boolean)=>{if(byPlayer)hits++;};
   const first=crowd.snapshot().people[0];
   sim.player.position={...first.position,z:first.position.z-1.2};sim.player.heading=0;
   const swung=crowd.punch();
   for(let i=0;i<30;i++)tick();
   const jabbed=crowd.snapshot().people[0].health;
   // A fresh mark takes one staged bat swing: native 18 over the authored 35.
   const second=crowd.snapshot().people[1];
   sim.player.position={x:second.position.x,y:second.position.y,z:second.position.z-1.2};
   sim.playerBody.setTranslation({x:second.position.x,y:second.position.y+.9,z:second.position.z-1.2},true);
   sim.playerBody.setNextKinematicTranslation({x:second.position.x,y:second.position.y+.9,z:second.position.z-1.2});
   sim.player.heading=0;sim.world.step();
   weapons.inventory.select(5);
   const dir={x:0,y:0,z:1};
   weapons.fire({origin:{...sim.player.position},direction:dir});
   // Bat_1's melee.dat hit frame is 11 of 30 fps: the blow lands 0.37 s into the swing.
   for(let i=0;i<30;i++)tick();
   const batted=crowd.snapshot().people[1].health;
   return {swung,hits,jabbed,batted};
  }finally{weapons.dispose();crowd.dispose();sim.dispose();}
 });
 expect(result.swung).toBe(true);expect(result.hits).toBe(1);expect(result.jabbed).toBeLessThan(100);
 // Staged bat damage survives where the authored flat 35 (×3 attack) would kill.
 expect(result.batted).toBeGreaterThan(0);expect(result.batted).toBeLessThan(100);
});
