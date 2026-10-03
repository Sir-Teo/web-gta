import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** An installed game started without a connection plays on the places it downloaded before (its service worker keeps
 * the game's data, the world's chunks keep themselves); walking past them, the hold and then the menu say there is no
 * connection rather than that loading failed, and once it is back, Resume loads the place. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('offline, a place never downloaded says there is no connection, and loads once it is back',async({page,context})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state().player.grounded,undefined,{timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.following.requests>=1&&s.following.pending===null;},null,{timeout:30000}).catch(()=>{});
 // No connection: the browser says so, and the world's downloads (the worker's too) fail as they do with none.
 await context.setOffline(true);await context.route('**/play/**',route=>route.abort('internetdisconnected'));
 // Downtown San Fierro, more than 4 km from the loaded window: nothing of it is on the device.
 await page.evaluate(()=>(window as any).__game.placePlayer(-2000,120,-300));
 await expect(page.locator('.prompt')).toContainText('No connection: the ground here loads once the connection is back',{timeout:20000});
 // The follower's retries run out: the menu says why, and that the place it came from is still there.
 await expect(page.locator('.menu-message')).toContainText('No connection: this part of San Andreas has not been downloaded yet',{timeout:90000});
 await context.unroute('**/play/**');await context.setOffline(false);
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__game.state();return s.player.position.x<-1900&&!s.terrainHold&&s.following.pending===null&&s.importedInstances>0;}),{timeout:90000}).toBe(true);
 expect(errors).toEqual([]);
});
