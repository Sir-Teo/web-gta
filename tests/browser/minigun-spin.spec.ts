import {test,expect} from '@playwright/test';
// CPlayerPed::ProcessControl: while the minigun's use-gun task runs its barrel spins up (0.025 a time step to 0.45) and
// CPed::PreRenderAfterTest turns the minigun2 frame by it; without the task it winds down 0.003 a step.
test('the minigun barrel spins up while aimed and winds down after',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="38"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 const canvas=page.locator('canvas').first(),box=(await canvas.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down({button:'right'});
 await expect.poll(async()=>(await state()).weapons.gunSpin,{timeout:5000}).toBeGreaterThan(.44);
 await page.mouse.up({button:'right'});
 await page.waitForTimeout(1000);
 const after=(await state()).weapons.gunSpin;
 expect(after).toBeLessThan(.44);expect(after).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
