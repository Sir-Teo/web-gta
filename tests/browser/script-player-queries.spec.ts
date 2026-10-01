import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// IS_CHAR_DUCKING (bIsDucking), IS_PLAYER_CLIMBING, IS_PLAYER_PRESSING_HORN, GET_CURRENT_POPULATION_ZONE_TYPE and
// ARE_ANY_CHARS_NEAR_CHAR read the player, the zone and who stands about as the script asks them.
test('the script reads CJ crouching, the horn and the population zone type',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 const ask=(member:string,...args:unknown[])=>page.evaluate(({member,args})=>(window as any).__game.missionForProfiling().adapterRef[member](...args),{member,args});
 expect(await ask('pedIsDucking',1)).toBe(false);
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
