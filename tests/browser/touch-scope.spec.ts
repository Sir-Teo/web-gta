import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Through a scope the touch controls trade Jump and Sprint for Zoom + and Zoom − (the PC's X and Z), and Aim stays
 * latched so the scope stays up. */
test.use({hasTouch:true});
test('a phone zooms the sniper scope in and out',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.weapons().inventory.select(34));await page.waitForTimeout(1000);
 const camera=()=>page.evaluate(()=>{const c=(window as any).__game.state().camera;return {fov:c.fov as number,firstPerson:c.firstPerson};});
 const controls=page.locator('.touch-controls');
 await page.locator('.touch-button.aim').dispatchEvent('pointerdown',{pointerType:'touch'});
 await expect.poll(async()=>(await camera()).firstPerson,{timeout:5000}).toBeTruthy();
 await expect(controls).toHaveAttribute('data-mode','scope');
 await expect(page.locator('.touch-button.aim')).toHaveClass(/\bon\b/);await expect(page.locator('.touch-button.jump:not([hidden])')).toHaveAttribute('aria-label','Zoom +');
 const hold=async(label:string,ms:number)=>{const b=page.getByRole('button',{name:label,exact:true});const box=(await b.boundingBox())!;
  const send=(type:string)=>page.evaluate(({type,x,y,label})=>[...document.querySelectorAll<HTMLButtonElement>('.touch-buttons button')].find(e=>e.getAttribute('aria-label')===label&&!e.hidden)!.dispatchEvent(new PointerEvent(type,{pointerId:31,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),{type,x:box.x+box.width/2,y:box.y+box.height/2,label});
  await send('pointerdown');await page.waitForTimeout(ms);await send('pointerup');};
 const wide=(await camera()).fov;
 await hold('Zoom +',1200);const near=(await camera()).fov;expect(near,JSON.stringify({wide,near})).toBeLessThan(wide-5);
 await hold('Zoom −',800);expect((await camera()).fov).toBeGreaterThan(near+2);
 // Aim again lets the scope go and the on-foot buttons come back.
 await page.locator('.touch-button.aim').dispatchEvent('pointerdown',{pointerType:'touch'});
 await expect.poll(async()=>(await camera()).firstPerson,{timeout:5000}).toBeFalsy();await expect(controls).toHaveAttribute('data-mode','foot');
 expect(errors).toEqual([]);
});
