import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('a native sniper round damages a seated mission ped once along its flight',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+8,y:-p.z,z:p.y+1},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});
 const rider=await page.evaluate(car=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.freezeVehiclePosition(car,true);return m.peds.createInCar(4,'MALE01',car,0);},car);
 await page.waitForFunction(({car,rider})=>{const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car);return !!m.peds.entity(rider)&&!!g.occupants().headOf(`script:${v.car.body.handle}:0`);},{car,rider},{timeout:30000});
 const fired=await page.evaluate(({car,rider})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),v=m.vehicles.entity(car);m.runtime.world.setPedHealth(rider,500);m.runtime.world.setPedSuffersCriticalHits(rider,false);
  const target=w.seatedPeds().find((t:any)=>t.rider===m.peds.entity(rider)),head=target.head,source={x:head.x+8,y:head.y+.1,z:head.z};
  const original=w.onSeatedShot;(window as any).__sniperOccupantHits=[];
  w.onSeatedShot=(t:any,damage:number,weapon:number)=>{if(t.rider===m.peds.entity(rider))(window as any).__sniperOccupantHits.push({damage,weapon});return original(t,damage,weapon);};
  w.inventory.select(34);w.firstPerson='sniper';w.aiming=true;
  const fired=w.fire({origin:source,direction:{x:-1,y:0,z:0}});return {fired,health:m.peds.entity(rider).health,bullets:w.snapshot().bullets,carHealth:v.health,weaponClock:w.nowMs};
 },{car,rider});
 expect(fired).toMatchObject({fired:true,health:500,bullets:1});
 await expect.poll(()=>page.evaluate(rider=>(window as any).__game.missionForProfiling().peds.entity(rider).health,rider),{timeout:10000}).toBe(375);
 // CBulletInfo expires after one second of simulated weapon time; terrain loading can hold that clock.
 await page.waitForFunction(at=>(window as any).__game.weapons().nowMs>at+1100,fired.weaponClock,{timeout:30000});
 expect(await page.evaluate(()=>(window as any).__game.weapons().snapshot().bullets)).toBe(0);
 const result=await page.evaluate(rider=>{const g=(window as any).__game,m=g.missionForProfiling();return {health:m.peds.entity(rider).health,hits:(window as any).__sniperOccupantHits,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},rider);
 writeFileSync('artifacts/sniper-occupant.json',JSON.stringify({fired,result,errors},null,2));
 expect(result).toEqual({health:375,hits:[{damage:125,weapon:34}],skipped:[],gaveUp:[]});expect(errors).toEqual([]);
 await page.evaluate(({car,rider})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.deletePed(rider);w.deleteVehicle(car);},{car,rider});
});
