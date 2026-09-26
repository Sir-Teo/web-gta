import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A hangar flight whose terrain request is never answered gives up after the terrain timeout, frees the menu and
 * says so, instead of holding the game on a busy menu for good. */
test('a map flight whose airfield never arrives gives up and frees the menu',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 // The airfield's request (terrain id -1) is lost on its way to the world worker.
 await page.addInitScript(()=>{const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(this:Worker,message:any,...rest:any[]){if(message?.action==='region'&&message.id===-1)return;return (post as any).call(this,message,...rest);};});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true&&!!(window as any).__game.fleet(),undefined,{timeout:90000});
 await page.keyboard.press('KeyM');await page.getByLabel('Aircraft',{exact:true}).selectOption('476');
 await page.getByRole('button',{name:'Fly from Verdant Meadows',exact:true}).click();
 await expect(page.locator('.menu-message')).toContainText('Loading Verdant Meadows');
 await expect(page.locator('.menu-message')).toHaveText('Verdant Meadows could not be loaded in time.',{timeout:70000});
 await expect(page.getByRole('button',{name:'Resume game',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().paused)).toBe(false);
 expect(errors).toEqual([]);
});
