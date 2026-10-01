import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// CWorld::RemoveFallenPeds and RemoveFallenCars: a script's ped or car that drops under the map (MAP_Z_LOW_LIMIT, -100)
// is put back over the nearest pedestrian node (two units for a ped, three for a car) rather than falling for ever, as
// Sweet did in SWEET1B while the mission waited for him to catch up.
test('a script ped and car fallen through the map come back up at a path node',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 const made=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return {ped:m.peds.create(4,'MALE01',{x:p.x+4,y:-p.z+2,z:p.y}),car:m.vehicles.create(400,{x:p.x+8,y:-p.z+6,z:p.y+1},0)};});
 await page.waitForFunction(({ped,car})=>{const m=(window as any).__game.missionForProfiling();return !!m.peds.entity(ped)&&!!m.vehicles.entity(car);},made,{timeout:60000});
 // Both dropped 150 units under the street.
 await page.evaluate(({ped,car})=>{const m=(window as any).__game.missionForProfiling(),q=m.peds.entity(ped),c=m.vehicles.entity(car).car.body,t=c.translation();
  const s=q.actor.player.position;q.body.setTranslation({x:s.x,y:-150,z:s.z},true);q.actor.player.position={...s,y:-150};
  c.setTranslation({x:t.x,y:-150,z:t.z},true);},made);
 const heights=()=>page.evaluate(({ped,car})=>{const m=(window as any).__game.missionForProfiling();return {ped:m.peds.entity(ped).actor.player.position.y,car:m.vehicles.entity(car).car.body.translation().y};},made);
 await expect.poll(async()=>(await heights()).ped,{timeout:20000}).toBeGreaterThan(-50);
 await expect.poll(async()=>(await heights()).car,{timeout:20000}).toBeGreaterThan(-50);
 const back=await heights();
 expect(back.ped).toBeGreaterThan(5);expect(back.car).toBeGreaterThan(5);
 expect(errors).toEqual([]);
});
