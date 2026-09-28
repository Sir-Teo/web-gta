import {test,expect} from '@playwright/test';

test('the HUD shows CHud::DrawAmmo under the weapon icon and no weapon name line',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 // Fists: hud.txd's fist raster (CHud::DrawWeaponIcon's SPRITE_FIST), nothing under the icon.
 await expect(page.locator('.native-weapon-icon')).toBeVisible();await expect(page.locator('svg.weapon')).toBeHidden();
 expect(await page.locator('.native-weapon-icon').getAttribute('src')).toMatch(/^data:image\/png/);
 await expect(page.locator('.weapon-ammo')).toBeHidden();
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="22"]').click();
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 const ammo=page.locator('.weapon-ammo');
 await expect(ammo).toBeVisible();await expect(ammo).toHaveText(/^\d+-\d+$/);
 expect(await ammo.evaluate(e=>getComputedStyle(e).color)).toBe('rgb(172, 203, 241)');
 await expect(page.locator('.weapon-readout')).toBeHidden();
 // The ammo sits under the icon.
 const icon=await page.locator('.native-weapon-icon').boundingBox(),text=await ammo.boundingBox();
 expect(text!.y).toBeGreaterThan(icon!.y+icon!.height*.5);
 expect(Math.abs(text!.x+text!.width/2-(icon!.x+icon!.width/2))).toBeLessThan(icon!.width);
 expect(errors).toEqual([]);
});
