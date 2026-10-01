import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const emergency=(page:Page)=>page.evaluate(()=>(window as any).__game.state().emergency);

// CCarCtrl::GenerateEmergencyServicesCar (AUTHORED from III/VC) with SA's CAccidentManager and the reversed medic tasks:
// two dead in the street within 30 units of CJ bring an ambulance with its siren on; its medics get out inside 10 units
// of the accident, give CPR (MEDIC CPR) and the body gets up (ComputeReviveResponse).
test('two dead in Grove Street bring an ambulance whose medics revive one',async({page})=>{
 test.setTimeout(420000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await emergency(page))?.ready,{timeout:60000}).toBe(true);
 // Two street peds near CJ die where they stand.
 let killed:number[]=[];
 await expect.poll(async()=>{
  killed=await page.evaluate(()=>{
   const g=(window as any).__game,s=g.state(),me=s.player.position;
   const near=s.pedestrians.people.filter((p:any)=>p.health>0&&!p.officer&&Math.hypot(p.position.x-me.x,p.position.z-me.z)<25).slice(0,2);
   if(near.length<2)return [];
   for(const p of near)g.killPed(p.id);
   return near.map((p:any)=>p.id);
  });
  return killed.length;
 },{timeout:120000,intervals:[2000]}).toBe(2);
 await expect.poll(async()=>(await emergency(page)).accidents.length,{timeout:20000}).toBeGreaterThanOrEqual(2);
 // The ambulance comes, siren on.
 await expect.poll(async()=>(await emergency(page)).units.length,{timeout:60000}).toBeGreaterThan(0);
 const unit=(await emergency(page)).units[0];
 expect(unit.modelId).toBe(416);expect(unit.siren).toBe(true);
 // Its crew get out and one of them treats an accident.
 // The bodies' 30 s to fading (CPopulation::ManagePed) is held here until a medic starts on one, so the test does not
 // hang on how far off the ambulance was made; CTaskComplexTreatAccident resets the clock itself once he does.
 await expect.poll(async()=>page.evaluate(ids=>{const g=(window as any).__game,e=g.state().emergency;
  if(!e.units[0]?.medics.some((m:any)=>m.task==='treat'))for(const id of ids)g.pedestrians().holdDead(id);
  return e.units[0]?.medics.some((m:any)=>m.task==='treat')??false;},killed),{timeout:150000,intervals:[1000]}).toBe(true);
 // The camera turned to the medic at work for the record.
 await page.evaluate(()=>{const g=(window as any).__game,e=g.state().emergency,m=e.units[0].medics.find((m:any)=>m.task==='treat'),me=g.state().player.position;
  const p=g.state().pedestrians.people.find((q:any)=>q.id===m.id)?.position??e.units[0].position;g.render().yaw=Math.atan2(p.x-me.x,p.z-me.z)+Math.PI;});
 await page.waitForTimeout(1500);
 await page.screenshot({path:'artifacts/emergency-ambulance-cpr.png'});
 // CPR ends in a revive: the accident is marked revived and the ped stands up alive.
 await expect.poll(async()=>(await emergency(page)).accidents.some((a:any)=>a.revived),{timeout:60000,intervals:[1000]}).toBe(true);
 const revived=(await emergency(page)).accidents.find((a:any)=>a.revived).id;
 await expect.poll(async()=>(await state(page)).pedestrians.people.find((p:any)=>p.id===revived)?.health,{timeout:20000}).toBe(100);
 await page.screenshot({path:'artifacts/emergency-ambulance-revived.png'});
 expect(errors).toEqual([]);
});
