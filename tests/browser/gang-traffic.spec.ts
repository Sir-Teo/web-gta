import {test,expect} from '@playwright/test';

test('gang turf sends the dominant gang\'s resident car into traffic with gang drivers',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldFleet},{Simulation},{loadWorldRoadMaterials},{gangCarShare},{GANG_CAR_GROUP_BASE},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/src/assets/populationCycle.ts','/src/simulation/nativePedRoster.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base) as any;
  try{
   for(let i=0;i<300&&!fleet.catalog;i++){fleet.update(i*100);await new Promise(r=>setTimeout(r,20));}
   const catalog=fleet.catalog;if(!catalog)throw new Error('fleet catalog did not load');
   // Ganton at 17:00: casual poor Los Santos with Families at full strength (INITIAL SET_ZONE_GANG_STRENGTH).
   sim.timeMinutes=17*60;
   const strengths=Array(10).fill(0);strengths[1]=255;
   fleet.currentZone={infoLabel:'GAN1',textLabel:'GANTON',zoneInfoIndex:0,level:1,populationType:8,gangStrength:strengths};
   const row=fleet.popRow();const share=gangCarShare(row,strengths);
   const groveCars=catalog.carGroups[GANG_CAR_GROUP_BASE+1].models as number[];
   const picks=Array.from({length:400},()=>fleet.trafficPick());
   const gangPicks=picks.filter((p:any)=>p.gang===1);
   const models=new Set(gangPicks.map((p:any)=>p.modelId));
   const resident=fleet.gangCarModel(1);
   fleet.forceRandomCarModel=()=>459;const forcedPicks=Array.from({length:400},()=>fleet.trafficPick());
   const forcedCivilians=[...new Set(forcedPicks.filter((p:any)=>p.gang===undefined).map((p:any)=>p.modelId))];
   const forcedGangs=[...new Set(forcedPicks.filter((p:any)=>p.gang===1).map((p:any)=>p.modelId))];
   return {forcedCivilians,forcedGangs,share,gangCount:gangPicks.length,models:[...models],groveCars,resident,otherGang:picks.some((p:any)=>p.gang!==undefined&&p.gang!==1),snapshot:fleet.snapshot().gangCars};
  }finally{fleet.dispose();sim.dispose();}
 });
 expect(result.share).toBeGreaterThan(0);
 // The gang share is drawn per car: 400 draws land near share*400.
 expect(Math.abs(result.gangCount-result.share*400)).toBeLessThan(60);
 expect(result.otherGang).toBe(false);
 // One resident Families car (greenwood, savanna or voodoo) serves every gang pick.
 expect(result.models.length).toBe(1);
 expect(result.groveCars).toContain(result.models[0]);
 expect(result.resident).toBe(result.models[0]);
 expect(result.snapshot).toEqual([[1,result.models[0]]]);
 expect(result.forcedCivilians).toEqual([459]);expect(result.forcedGangs).toEqual([result.resident]);
});
