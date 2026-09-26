import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The map's hangar flight puts the player in a new aircraft from on foot only. Riding a bike it refuses and says why,
 * in the map's status line, which every redraw used to overwrite at once. */
test('a map flight chosen while riding a bike is refused with its reason, and the bike stays ridden',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true&&!!(window as any).__game.fleet(),undefined,{timeout:90000});
 expect(await page.evaluate(async()=>{const g=(window as any).__game,p=g.state().player,bike=await g.fleet().spawnCheatVehicle(481,p.position,p.heading);if(!bike)return false;const t=bike.body.translation();g.placePlayer(t.x+1.2,t.y,t.z);return true;})).toBe(true);
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.keyboard.press('KeyF');
 await page.waitForFunction(()=>!!(window as any).__game.fleet().occupiedBike,undefined,{timeout:30000});
 await page.keyboard.press('KeyM');await page.getByLabel('Aircraft',{exact:true}).selectOption('476');
 await page.getByRole('button',{name:'Fly from Verdant Meadows',exact:true}).click();
 await expect(page.locator('.map-status')).toHaveText('Leave your current vehicle before choosing another plane.');
 await page.waitForTimeout(1000);
 expect(await page.evaluate(()=>{const f=(window as any).__game.fleet();return {bike:!!f.occupiedBike,plane:!!f.occupiedPlane};})).toEqual({bike:true,plane:false});
 await expect(page.locator('.map-status')).toHaveText('Leave your current vehicle before choosing another plane.');
 expect(errors).toEqual([]);
});
