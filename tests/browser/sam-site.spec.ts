import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CObject::ProcessSamSiteBehaviour (reversed): Area 69's SAM sites, real objects within 750 of the player
 * (FindDummyDistForModel), turn on a player flying near and fire heat-seeking rockets at his plane. They stood still
 * as part of the map, and SET_AREA51_SAM_SITE and SET_AIRCRAFT_CARRIER_SAM_SITE (MANSIO2) switched nothing. */
test('an Area 69 SAM site turns on the player\'s plane and fires a heat-seeker at it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,250,1830,18));
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:90000});
 // The sites near him have become objects.
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().samSites.size as number),{timeout:30000}).toBeGreaterThan(0);
 const site=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),o=m.runtime.game.objects;
  const sites=[...m.samSites.values()].map((h:number)=>o.at(h)).sort((a:any,b:any)=>Math.hypot(a.position.x-250,a.position.y-1830)-Math.hypot(b.position.x-250,b.position.y-1830));
  const s=sites[0];return {handle:s.handle as number,position:s.position as {x:number;y:number;z:number},heading:s.heading as number};});
 // A plane held 80 off and 40 up, the player at its controls.
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const plane=await page.evaluate(({x,y,z})=>(window as any).__game.missionForProfiling().vehicles.create(476,{x,y,z},0) as number,{x:site.position.x+80,y:site.position.y,z:site.position.z+40});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),plane,{timeout:60000});
 await w('freezeVehiclePosition',plane,true);
 await w('warpPedIntoCar',1,plane);
 const heatSeekers=()=>page.evaluate((h:number)=>{const g=(window as any).__game,body=g.missionForProfiling().vehicles.entity(h).body.handle;
  return g.weapons().projectiles.filter((p:any)=>p.weapon===36&&p.target===body).length as number;},plane);
 await expect.poll(heatSeekers,{timeout:20000}).toBeGreaterThan(0);
 const turned=await page.evaluate((h:number)=>(window as any).__game.missionForProfiling().runtime.game.objects.at(h).heading as number,site.handle);
 expect(turned).not.toBeCloseTo(site.heading,3);
 expect(errors).toEqual([]);
});
