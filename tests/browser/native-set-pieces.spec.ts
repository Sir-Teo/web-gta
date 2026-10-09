import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CSetPieces: with one star on foot inside the set piece at (2295–2302, −1772 to −1761), two cops appear at its spawn
// points (2263, −1780) and (2327, −1821).
test('a set piece sends two cops at a wanted player on foot',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await expect.poll(async()=>(await state()).setPieces?.count,{timeout:30000}).toBe(209);
 // Walk the streaming over first (a far teleport into unloaded collision pauses the game), then stand in the area.
 for(const [x,z] of [[2400,1740],[2330,1760],[2298.5,1766.5]]){
  await page.evaluate(({x,z})=>{const g=(window as any).__game;const y=g.groundAt(x,z,60);if(y!==null)g.placePlayer(x,y,z);},{x,z});
  await page.waitForTimeout(2500);
 }
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2298.5,g.groundAt(2298.5,1766.5,60),1766.5);});
 await page.waitForTimeout(1500);
 // A region swap near the alley fence can pause on its obstruction check; the previous terrain stays usable.
 if((await state()).paused)await page.getByRole('button',{name:'Resume game',exact:true}).click();
 const officers=async()=>(await state()).pedestrians.people.filter((p:any)=>p.officer&&p.health>0).map((p:any)=>[Math.round(p.position.x),Math.round(-p.position.z)]);
 const before=(await officers()).length;
 await page.evaluate(()=>(window as any).__game.setWantedLevel(1));
 await expect.poll(async()=>(await state()).setPieces.generated,{timeout:30000}).toBeGreaterThan(0);
 const cops=await officers();expect(cops.length).toBeGreaterThanOrEqual(before+2);
 const near=(x:number,y:number)=>cops.some(([cx,cy]:number[])=>Math.hypot(cx-x,cy-y)<25);
 expect(near(2263,-1780)||near(2327,-1821)).toBe(true);
 expect(errors).toEqual([]);
});
