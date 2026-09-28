import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** While a knockdown's fall and get-up own CJ, CTaskSimplePlayerOnFoot (and its ProcessPlayerWeapon) is not running:
 * the aim button neither raises the gun nor fires it until he is back up, and PlayerControlZelda's duck and jump do
 * not start. */
test('a knocked-down CJ neither aims, fires, ducks nor jumps, and aims again once up',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {knockdown:s.knockdown,action:s.nativeCharacter?.action,shots:s.weapons.shots,grounded:s.player.grounded,crouched:s.player.crouched};});
 await expect.poll(async()=>(await state()).grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="22"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().weapons.ready)).toBe(true);
 await page.evaluate(()=>{(window as any).__game.sim.knockdown=3;});
 await page.keyboard.press('KeyC');await page.keyboard.press('Space');
 await page.mouse.move(700,450);await page.mouse.down({button:'right'});await page.mouse.down({button:'left'});
 const down:{knockdown:number;action:string;shots:number;crouched:boolean}[]=[];
 for(let s=await state();s.knockdown>0;s=await state()){down.push(s);await page.waitForTimeout(100);}
 await page.mouse.up({button:'left'});
 expect(down.length).toBeGreaterThan(0);
 expect(down.filter(s=>s.action==='gunMove'||s.shots>0||s.crouched||s.action==='launch')).toEqual([]);
 await expect.poll(async()=>(await state()).action,{timeout:30000}).toBe('gunMove');
 await page.mouse.up({button:'right'});
 expect(errors).toEqual([]);
});
