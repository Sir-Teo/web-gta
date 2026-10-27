import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('seated mission peds keep distinct civilian/cop/gang crime identity through the live weapon host',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const vehicle=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+8,y:-p.z,z:p.y+1},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),vehicle,{timeout:45000});
 const riders=await page.evaluate(vehicle=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.freezeVehiclePosition(vehicle,true);return [{type:4,seat:'driver',name:'CIVMALE'},{type:6,seat:0,name:'COP'},{type:7,seat:1,name:'GANG1'}].map(c=>({...c,handle:m.peds.createInCar(c.type,'MALE01',vehicle,c.seat)}));},vehicle);
 await page.waitForFunction(riders=>{const g=(window as any).__game,m=g.missionForProfiling();return riders.every(r=>g.weapons().seatedPeds().some((t:any)=>t.rider===m.peds.entity(r.handle)&&!!t.head));},riders,{timeout:30000});
 const results=await page.evaluate(({vehicle,riders})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),original=w.onCrime,out:any[]=[];let calls:any[]=[];
  w.onCrime=(...args:any[])=>{calls.push(args);original?.(...args);};
  try{
   for(const r of riders){
    m.runtime.world.setPedHealth(r.handle,500);m.runtime.world.setPedSuffersCriticalHits(r.handle,false);const target=w.seatedPeds().find((t:any)=>t.rider===m.peds.entity(r.handle));calls=[];
    w.damageSeated(target,10,22);out.push({...r,pedType:target.pedType,crimeVictim:target.crimeVictim,health:target.rider.health,calls:[...calls]});
    if(r.name==='COP'){calls=[];w.damageSeated(target,125,34,true);out.push({...r,sniper:true,pedType:target.pedType,crimeVictim:target.crimeVictim,health:target.rider.health,calls:[...calls]});}
    if(r.name==='GANG1'){
     const at=m.runtime.world.vehiclePosition(vehicle);m.runtime.world.givePedScriptedTask(r.handle,{kind:'driveBy',targetPed:-1,targetVehicle:-1,x:at.x+20,y:at.y,z:at.z,radius:100,type:0,rightHandCarSeat:true,fireRate:10},0x0713);
     const active=w.seatedPeds().find((t:any)=>t.rider===m.peds.entity(r.handle));
     for(const fatal of [false,true]){calls=[];w.damageSeated(active,fatal?1000:10,22);out.push({...r,driveBy:active.activeDriveBy,fatal,pedType:active.pedType,crimeVictim:active.crimeVictim,health:active.rider.health,calls:[...calls]});}
    }
   }
  }finally{w.onCrime=original;}
  return {out,carHealth:m.vehicles.entity(vehicle).health};
 },{vehicle,riders});
 writeFileSync('artifacts/seated-crime.json',JSON.stringify({results,errors},null,2));
 expect(results.carHealth).toBe(1000);
 for(const r of results.out){const cop=r.name==='COP',care=r.name==='GANG1',id=`script-ped:${r.handle}`;expect(r.pedType).toBe(r.name);expect(r.crimeVictim).toBe(id);expect(r.health).toBe(r.driveBy?r.fatal?0:480:r.sniper?365:490);expect(r.calls).toEqual([[2,id,false,care],...r.driveBy&&!r.fatal?[]:[[cop?5:4,id,true,care]],[r.sniper&&cop?5:4,id,false,care]]);}
 expect(new Set(results.out.filter((r:any)=>!r.sniper).map((r:any)=>r.crimeVictim)).size).toBe(3);expect(errors).toEqual([]);
 await page.evaluate(({vehicle,riders})=>{const w=(window as any).__game.missionForProfiling().runtime.world;for(const r of riders)w.deletePed(r.handle);w.deleteVehicle(vehicle);},{vehicle,riders});
});
