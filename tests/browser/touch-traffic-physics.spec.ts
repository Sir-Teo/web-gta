import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A phone drives the random traffic under physics within 60 units of the player and on rails beyond (STATUS_SIMPLE,
 * slowing for the traffic and the lights ahead), where the desktop keeps 100: each car under physics costs its
 * suspension, wheels and drive twice a frame, and one 60 units off is a few pixels on a phone's screen. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('a phone runs the traffic\'s physics within 60 units and drives the rest on rails',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await expect.poll(()=>page.evaluate(()=>[...(window as any).__game.fleet().cars].filter((c:any)=>c.autopilot&&c.activeRadius<=100).length),{timeout:60000}).toBeGreaterThan(2);
 const sample=()=>page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;
  return [...g.fleet().cars].filter((c:any)=>c.autopilot&&c.activeRadius<=100).map((c:any)=>{const b=c.car.body,t=b.translation();
   return {radius:c.activeRadius,distance:Math.hypot(t.x-p.x,t.z-p.z),physics:b.isEnabled()&&!b.isSleeping()};});});
 const first=await sample();
 expect(first.every(c=>c.radius===60)).toBe(true);
 // Beyond the radius (and its five units of hysteresis) a car is on rails, its body out of the physics.
 await expect.poll(async()=>(await sample()).filter(c=>c.distance>66&&c.physics).length,{timeout:10000}).toBe(0);
 expect(errors).toEqual([]);
});
