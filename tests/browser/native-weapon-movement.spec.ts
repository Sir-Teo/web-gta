import {test,expect} from '@playwright/test';
test('heavy weapons and aiming suppress jump launch while unarmed sprint still works',async({page})=>{
 test.setTimeout(60000);await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:45000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 const equip=async(id:number)=>{await page.keyboard.press('Tab');await page.locator(`[data-weapon="${id}"]`).click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);};
 await equip(38);await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.keyboard.press('Space');await page.waitForTimeout(350);
 let s=await state();expect(s.player.grounded).toBe(true);
 // WALK_start, then walk into run as the move ratio climbs past 2 (about 0.6 s).
 await expect.poll(async()=>(await state()).nativeCharacter.action).toBe('run');
 await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await equip(22);
 await page.mouse.move(750,420);await page.mouse.down({button:'right'});await page.keyboard.press('Space');await page.waitForTimeout(250);
 s=await state();expect(s.player.grounded).toBe(true);expect(s.nativeCharacter.action).not.toContain('launch');await page.mouse.up({button:'right'});
 await equip(0);await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
 await expect.poll(async()=>(await state()).nativeCharacter.action).toBe('sprint');
 await page.screenshot({path:'artifacts/native-movement-sprint.png'});await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
});
