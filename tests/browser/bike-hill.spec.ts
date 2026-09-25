import {test,expect} from '@playwright/test';
/** A pedalled BMX climbs a 15% hill: its level body rides up the grade on its frictionless wheel spheres. */
test('a BMX pedals up a 15% hill',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const catalog=await openStaticWorldVehicles(await openStaticWorld(base));
  const sim=new Simulation(),scene=new THREE.Scene();
  // A flat run-up, then a slab tilted up at 15% towards -z (the bike's forward at heading 0).
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0));
  const angle=Math.atan(.15);
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(10,.5,40).setTranslation(0,Math.sin(angle)*40-.5,-40-8).setRotation({x:Math.sin(angle/2),y:0,z:0,w:Math.cos(angle/2)}));
  sim.respawn={x:1.5,y:.55,z:2};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const bike=new WorldBike(sim,scene,await loadFixedWorldBike(catalog,{modelId:481,primaryColor:-1,secondaryColor:-1}),{x:0,y:1.5,z:0},0);
  try{
   const tick=(input?:{throttle:number;steer:number;brake:boolean})=>{bike.beforeStep(1/60,input);sim.world.step();bike.afterStep();bike.update(1);};
   for(let i=0;i<30;i++)tick();
   bike.interact();
   // Six seconds of pedalling: the ramp's far end (z = -88, 12 units up) is not reached.
   let top={y:-Infinity,z:0};
   for(let i=0;i<60*6;i++){tick({throttle:1,steer:0,brake:false});const t=bike.body.translation();if(t.y>top.y)top={y:t.y,z:t.z};}
   return {topY:top.y,topZ:top.z};
  }finally{bike.dispose();sim.dispose();}
 });
 // Well up the slope, on it: the grade (0.15 a unit past the foot at z = -8) gives the height.
 expect(result.topZ).toBeLessThan(-30);expect(result.topY).toBeGreaterThan((-8-result.topZ)*.15-.5);
 expect(errors).toEqual([]);
});
