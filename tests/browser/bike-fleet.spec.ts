import {test,expect} from '@playwright/test';

test('a bike generator parks its bike, and the fleet invents none of its own',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{loadWorldRoadMaterials},{WorldFleet},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/worldRoadMaterials.ts','/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0));
  sim.respawn={x:0,y:.55,z:0};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base);
  const out:Record<string,unknown>={};
  try{
   // With no generator near, no bike appears however long the fleet runs.
   fleet.generateEvenIfClose();
   for(let i=0;i<60;i++){fleet.update(i*100);await new Promise(r=>setTimeout(r,20));}
   out.invented=fleet.bikes.size;
   // A BMX generator 20 units north of the player: CCarGenerator::DoInternalProcessing parks it on the ground.
   fleet.setGenerators([{id:'test:bmx',source:'test.ipl',sourceIndex:0,position:[0,20,0],angle:Math.PI/2,modelId:481,primaryColor:-1,secondaryColor:-1,flags:0,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0}]);
   fleet.generateEvenIfClose();
   let bike:any;
   for(let i=0;i<300&&!bike;i++){fleet.update(6000+i*100);await new Promise(r=>setTimeout(r,20));bike=[...fleet.bikes][0];}
   out.spawned=!!bike;
   if(bike){
    const p=bike.body.translation();out.position={x:+p.x.toFixed(2),z:+p.z.toFixed(2)};
    for(let i=0;i<60;i++){bike.beforeStep(1/60);sim.world.step();bike.afterStep();}
    out.settled=bike.body.translation().y;
    out.nearest=fleet.nearestBike()===bike;
   }
   out.snapshot=fleet.snapshot().bikes.map((b:any)=>b.modelId);
   out.failures=fleet.snapshot().failures;
   return out;
  }finally{fleet.dispose();sim.dispose();}
 });
 expect(result.invented).toBe(0);
 expect(result.spawned,JSON.stringify(result.failures)).toBe(true);
 expect(result.position).toEqual({x:0,z:-20});
 expect(result.settled).toBeGreaterThan(0);
 expect(result.settled).toBeLessThan(1);
 expect(result.nearest).toBe(true);
 expect(result.snapshot).toEqual([481]);
 expect(errors).toEqual([]);
});
