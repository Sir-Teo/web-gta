import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

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

/** CBike::ProcessControl's fake physics: an abandoned bike at rest skips its physics, at once when CREATE_CAR has left it
 * idle. TWAR7 makes the Ballas rider's PCJ-600 in the yard behind his house, on a slope; with no rest it rolled back
 * three units and nosed down past a ledge, out of his reach, and the mission waited on him for good. */
test('a script bike made on a slope stays where it was made',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,2469,-1279,30));
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:90000});
 await page.waitForTimeout(2000);
 const bike=await page.evaluate(()=>(window as any).__game.missionForProfiling().vehicles.create(461,{x:2488.2,y:-1279.9,z:30},286.4));
 await page.waitForFunction(b=>!!(window as any).__game.missionForProfiling().vehicles.entity(b),bike,{timeout:60000});
 const at=()=>page.evaluate(b=>(window as any).__game.missionForProfiling().runtime.world.vehiclePosition(b),bike);
 const first=await at();await page.waitForTimeout(6000);const later=await at();
 expect(Math.hypot(later.x-first.x,later.y-first.y)).toBeLessThan(.3);
 expect(errors).toEqual([]);
});
