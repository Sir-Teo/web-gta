import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SET_PLAYER_JUMP_BUTTON, _DUCK_BUTTON, _FIRE_BUTTON, _ENTER_CAR_BUTTON and _CYCLE_WEAPON_BUTTON: CPad's getters answer
 * nothing for a button whose bDisablePlayer flag the script has put up (the gyms, the shooting range, MUSIC2), and the
 * button works again once it is let go. */
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const pads=(page:Page,button:string,off:boolean)=>page.evaluate(({button,off})=>(window as any).__game.missionForProfiling().runtime.game.pads.setDisabled(0,button,off),{button,off});
test('a script switches off the jump, duck, fire and weapon-cycle buttons',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.locator('canvas').first().click({position:{x:5,y:5}}).catch(()=>{});
 // Jump: Space does nothing while the button is off.
 await pads(page,'jump',true);
 await page.keyboard.down('Space');await page.waitForTimeout(500);await page.keyboard.up('Space');
 expect((await state(page)).player.grounded).toBe(true);
 await pads(page,'jump',false);
 await page.keyboard.down('Space');
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:5000,intervals:[50]}).toBe(false);
 await page.keyboard.up('Space');
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:10000}).toBe(true);
 // Duck: C does not crouch.
 await pads(page,'duck',true);
 await page.keyboard.press('KeyC');await page.waitForTimeout(600);
 expect((await state(page)).player.crouched).toBe(false);
 await pads(page,'duck',false);
 await page.keyboard.press('KeyC');
 await expect.poll(async()=>(await state(page)).player.crouched,{timeout:5000}).toBe(true);
 await page.keyboard.press('KeyC');
 await expect.poll(async()=>(await state(page)).player.crouched,{timeout:5000}).toBe(false);
 // Fire and cycle: a pistol keeps its clip under Ctrl, and the wheel leaves it selected.
 await page.evaluate(()=>{const g=(window as any).__game;g.weapons().inventory.give(22,50);g.weapons().inventory.give(25,20);g.weapons().inventory.select(22);});
 await page.waitForTimeout(500);
 const clip=()=>page.evaluate(()=>{const inv=(window as any).__game.weapons().inventory;return inv.ammo.get(22).clip;});
 const before=await clip();
 await pads(page,'fireWeapon',true);
 await page.keyboard.down('ControlLeft');await page.waitForTimeout(800);await page.keyboard.up('ControlLeft');
 expect(await clip()).toBe(before);
 await pads(page,'fireWeapon',false);
 await page.keyboard.down('ControlLeft');await page.waitForTimeout(800);await page.keyboard.up('ControlLeft');
 await expect.poll(clip,{timeout:5000}).toBeLessThan(before);
 await pads(page,'cycleWeapon',true);
 await page.mouse.move(400,300);await page.mouse.wheel(0,120);await page.waitForTimeout(400);
 expect(await page.evaluate(()=>(window as any).__game.weapons().inventory.selected)).toBe(22);
 await pads(page,'cycleWeapon',false);
 await page.mouse.wheel(0,120);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.weapons().inventory.selected),{timeout:5000}).not.toBe(22);
 expect(errors).toEqual([]);
});
