import {test,expect} from '@playwright/test';

// PC mouse and keys (CCamera::m_bUseMouse3rdPerson): ProcessPlayerWeapon clears any gun lock, so shots follow the crosshair.
test('free aim: shots follow the crosshair and the ped under it is the mouse target',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WeaponSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/weapons/WeaponSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined),weapons=new WeaponSystem(sim,()=>crowd,()=>undefined);
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const tick=()=>{weapons.tick(1/60);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   for(let i=0;i<30;i++)tick();
   const target=crowd.targets()[0];if(!target)throw new Error('No civilian');
   const chest={...target.position};
   sim.player.position={x:chest.x,y:chest.y-1.3,z:chest.z+6};sim.playerBody.setTranslation({...sim.player.position,y:chest.y-.4,z:chest.z+6},true);sim.world.step();
   weapons.inventory.select(22);weapons.aiming=true;
   const aimAt=(x:number)=>{const d={x:x-sim.player.position.x,y:0,z:chest.z-sim.player.position.z},l=Math.hypot(d.x,d.z);return {origin:{...sim.player.position,y:chest.y},direction:{x:d.x/l,y:0,z:d.z/l}};};
   const health=()=>crowd.snapshot().people.find((p:any)=>p.id===0)?.health;
   // A metre and a half to the side: nothing under the crosshair, and the shots miss.
   const off=aimAt(chest.x+1.5);
   for(let i=0;i<5;i++){weapons.tick(1/60,off);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}
   const offTarget=weapons.lock?.handle??null,before=health();
   for(let i=0;i<3;i++){weapons.tick(1/60,off);weapons.fire(off);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}
   const missed=health();
   // The missed shots scare it (CEventGunShot), so the crosshair follows the ped from here.
   const chestNow=()=>crowd.targets().find((t:any)=>t.handle===target.handle)?.position??chest;
   const onAt=()=>{const c=chestNow(),d={x:c.x-sim.player.position.x,y:0,z:c.z-sim.player.position.z},l=Math.hypot(d.x,d.z);return {origin:{...sim.player.position,y:c.y},direction:{x:d.x/l,y:0,z:d.z/l}};};
   for(let i=0;i<5;i++){weapons.tick(1/60,onAt());crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}
   const onTarget=weapons.lock?.handle??null;
   for(let i=0;i<40&&health()===missed;i++){const on=onAt();weapons.tick(1/60,on);weapons.fire(on);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}
   return {offTarget,onTarget,expected:target.handle,before,missed,after:health()};
  }finally{weapons.dispose();crowd.dispose();sim.dispose();}
 });
 expect(result.offTarget).toBeNull();expect(result.missed).toBe(result.before);
 expect(result.onTarget).toBe(result.expected);expect(result.after).toBeLessThan(result.missed ?? 100);
});
