import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// IS_CHAR_DUCKING (bIsDucking), IS_PLAYER_CLIMBING, IS_PLAYER_PRESSING_HORN and GET_CURRENT_POPULATION_ZONE_TYPE read
// the player and the zone as the script asks them.
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
 expect(errors).toEqual([]);
});
