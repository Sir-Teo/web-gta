import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// SET_TAXI_LIGHTS (CAutomobile::SetTaxiLight): a lit taxi sign shows its roof corona (the iOS PreRender's, at high FX
// quality, the game's default here).
test('a taxi whose light the script turns on shows its roof corona',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 const car=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position,h=g.sim.player.heading;
  return m.vehicles.create(420,{x:p.x+Math.sin(h)*7,y:-(p.z+Math.cos(h)*7),z:p.y+1},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:60000});
 const lit=()=>page.evaluate(h=>{const g=(window as any).__game,c=g.missionForProfiling().vehicles.entity(h);return {flag:c.taxiLight,coronas:g.state().coronas.count};},car);
 await page.waitForTimeout(1500);
 const before=await lit();expect(before.flag).toBe(false);
 await page.evaluate(h=>(window as any).__game.missionForProfiling().adapterRef.setTaxiLights(h,true),car);
 await expect.poll(async()=>(await lit()).coronas,{timeout:10000}).toBeGreaterThan(before.coronas);
 expect((await lit()).flag).toBe(true);
 await page.evaluate(h=>{const g=(window as any).__game,c=g.missionForProfiling().vehicles.entity(h).car.body.translation(),me=g.state().player.position;g.render().yaw=Math.atan2(c.x-me.x,c.z-me.z)+Math.PI;},car);
 await page.waitForTimeout(800);
 await page.screenshot({path:'artifacts/taxi-light.png'});
 expect(errors).toEqual([]);
});
