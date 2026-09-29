import {test,expect} from '@playwright/test';

/** CBike rides on suspension lines, which never raise a collision: only the bike's collision model (frame and
 * rider spheres) feeds DamageKnockOffRider. Kerbs and bumps the wheels climb leave the rider on; a wall still
 * throws him. */
test('a BMX rides over kerbs and bumps without throwing the rider, and a wall still does',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const catalog=await openStaticWorldVehicles(await openStaticWorld(base));
  const out:Record<string,unknown>={};
  for(const modelId of [481,462]){
   const sim=new Simulation(),scene=new THREE.Scene();
   sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,400).setTranslation(0,-.5,0));
   // Kerbs 0.15 high (a raised stretch every 40 units) and 0.15-unit speed bumps between them.
   for(let i=0;i<8;i++){
    const z=-20-i*40;
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(10,.075,10).setTranslation(0,.075,z));
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(10,.05,.5).setTranslation(0,0,z-20).setRotation({x:Math.sin(Math.PI/32),y:0,z:0,w:Math.cos(Math.PI/32)}));
   }
   sim.respawn={x:1.5,y:.55,z:2};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
   const bike=new WorldBike(sim,scene,await loadFixedWorldBike(catalog,{modelId,primaryColor:-1,secondaryColor:-1}),{x:0,y:1.5,z:0},0);
   const r:Record<string,unknown>={};out[modelId]=r;
   try{
    const tick=(input?:{throttle:number;steer:number;brake:boolean})=>{bike.beforeStep(1/60,input);sim.world.step();bike.afterStep();bike.update(1);};
    for(let i=0;i<30;i++)tick();
    bike.interact();
    let top=0;
    for(let i=0;i<900&&bike.snapshot().occupied&&bike.snapshot().position.z>-330;i++){tick({throttle:1,steer:0,brake:false});top=Math.max(top,Math.abs(bike.snapshot().speed));}
    r.rode=bike.snapshot().occupied;r.z=bike.snapshot().position.z;r.top=top;r.message=bike.message;
    // A wall met at speed still throws him.
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(5,3,.5).setTranslation(0,3,-360));
    bike.body.setTranslation({x:0,y:1.5,z:-340},true);bike.body.setRotation({x:0,y:0,z:0,w:1},true);bike.body.setLinvel({x:0,y:0,z:-30},true);
    for(let i=0;i<120&&bike.snapshot().occupied;i++)tick({throttle:0,steer:0,brake:false});
    r.wallKnocked=!bike.snapshot().occupied;
   }finally{bike.dispose();sim.dispose();}
  }
  return out;
 });
 for(const r of Object.values(result) as any[]){
  expect(r.rode,r.message).toBe(true);
  // Past two raised stretches (four kerbs) and two speed bumps.
  expect(r.z).toBeLessThan(-100);
  expect(r.wallKnocked).toBe(true);
 }
 expect(errors).toEqual([]);
});
