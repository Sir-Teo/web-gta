import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// IS_CHAR_DUCKING (bIsDucking), IS_PLAYER_CLIMBING, IS_PLAYER_PRESSING_HORN, GET_CURRENT_POPULATION_ZONE_TYPE and
// ARE_ANY_CHARS_NEAR_CHAR read the player, the zone and who stands about as the script asks them. GET_CHAR_SPEED and
// GET_CHAR_VELOCITY cross in units a frame (the handlers scale them by fifty), and GET_CHAR_HEIGHT_ABOVE_GROUND is his
// origin over the ground.
test('the script reads CJ crouching, the horn and the population zone type',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 const ask=(member:string,...args:unknown[])=>page.evaluate(({member,args})=>(window as any).__game.missionForProfiling().adapterRef[member](...args),{member,args});
 expect(await ask('pedIsDucking',1)).toBe(false);
 // Standing: no speed, no velocity, his origin a unit over the street.
 expect(await ask('pedSpeed',1)).toBeLessThan(.01);
 const still=await ask('pedVelocity',1) as {x:number;y:number;z:number};expect(Math.hypot(still.x,still.y,still.z)).toBeLessThan(.01);
 const height=await ask('getCharHeightAboveGround',1) as number;expect(height).toBeGreaterThan(.5);expect(height).toBeLessThan(1.5);
 // Running forward: a few units a second, so a fiftieth of that a frame, along his heading.
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.keyboard.down('KeyW');await page.waitForTimeout(1500);
 const speed=await ask('pedSpeed',1) as number,moving=await ask('pedVelocity',1) as {x:number;y:number;z:number};
 await page.keyboard.up('KeyW');
 expect(speed*50).toBeGreaterThan(2);expect(speed*50).toBeLessThan(12);
 expect(Math.hypot(moving.x,moving.y)*50).toBeGreaterThan(1.5);expect(Math.hypot(moving.x,moving.y)*50).toBeLessThan(14);
 await page.keyboard.press('KeyC');
 await expect.poll(()=>ask('pedIsDucking',1),{timeout:5000}).toBe(true);
 await page.keyboard.press('KeyC');
 await expect.poll(()=>ask('pedIsDucking',1),{timeout:5000}).toBe(false);
 expect(await ask('isPlayerClimbing',0)).toBe(false);
 // On foot the horn is nobody's.
 await page.keyboard.down('KeyH');expect(await ask('isPlayerPressingHorn',0)).toBe(false);await page.keyboard.up('KeyH');
 // Grove Street's popcycle zone type, a number the zone's row gives.
 await expect.poll(async()=>typeof await ask('currentPopulationZoneType'),{timeout:30000}).toBe('number');
 // ARE_ANY_CHARS_NEAR_CHAR: a ped the script makes two units off is near CJ, and CJ is near him.
 const ped=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;return m.peds.create(4,'MALE01',{x:p.x+2,y:-p.z,z:p.y});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 await expect.poll(()=>ask('anyPedsNearPed',1,4),{timeout:10000}).toBe(true);
 expect(await ask('anyPedsNearPed',ped,4)).toBe(true);
 expect(await ask('anyPedsNearPed',ped,.2)).toBe(false);
 expect(errors).toEqual([]);
});
