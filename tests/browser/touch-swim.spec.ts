import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** In the water the touch controls are the mobile ports' swimming set: Dive (the fire button, under the surface), Swim
 * (the fast stroke) and Jump; Aim, Crouch and the rest go, and Enter does too with no vehicle beside CJ. */
test.use({hasTouch:true});
test('a phone swims with Dive and Swim, and Enter shows only beside a vehicle',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:90000}).toBe(true);
 await endStoryMission(page);
 const controls=page.locator('.touch-controls'),enter=page.locator('.touch-button.enter');
 // Grove Street starts beside the Greenwood.
 await expect(enter).toBeVisible({timeout:10000});
 await page.evaluate(()=>(window as any).__game.placePlayer(2600,2,2600));
 await expect.poll(async()=>(await state()).player.swimming,{timeout:60000}).toBe(true);
 await expect(controls).toHaveAttribute('data-mode','swim');
 await expect(page.getByRole('button',{name:'Dive',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Swim',exact:true})).toBeVisible();
 await expect(page.locator('.touch-button.aim')).toBeHidden();await expect(page.locator('.touch-button.crouch:not([hidden])')).toHaveCount(0);
 await expect(enter).toBeHidden();
 // Dive takes CJ under.
 const dive=page.getByRole('button',{name:'Dive',exact:true}),box=(await dive.boundingBox())!;
 const send=(type:string)=>page.evaluate(({type,x,y})=>[...document.querySelectorAll<HTMLButtonElement>('.touch-buttons button')].find(b=>b.getAttribute('aria-label')==='Dive'&&!b.hidden)!.dispatchEvent(new PointerEvent(type,{pointerId:41,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),{type,x:box.x+box.width/2,y:box.y+box.height/2});
 const surface=(await state()).player.position.y;
 await send('pointerdown');await page.waitForTimeout(400);await send('pointerup');
 await expect.poll(async()=>(await state()).player.position.y,{timeout:10000}).toBeLessThan(surface-.5);
 expect(errors).toEqual([]);
});
