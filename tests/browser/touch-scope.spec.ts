import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Through a scope the touch controls trade Jump and Sprint for Zoom + and Zoom − (the PC's X and Z), two fingers on the
 * look side pinch the zoom, and Aim stays latched so the scope stays up. */
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
 // Two fingers on the look side pinch, as the port's scope: spread to three times apart, the view's half-width is a
 // third, and the camera does not turn while they do; one lifted, the other looks on and the zoom stays.
 const finger=(type:string,id:number,x:number,y:number)=>page.evaluate(({type,id,x,y})=>{document.querySelector('.touch-look')!.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:id===41,clientX:x,clientY:y,bubbles:true,cancelable:true}));},{type,id,x,y});
 await page.waitForTimeout(300);const before=await camera(),beforeYaw=await page.evaluate(()=>(window as any).__game.state().camera.viewYaw as number);
 await finger('pointerdown',41,500,200);await finger('pointerdown',42,560,200);
 for(let step=1;step<=6;step++){await finger('pointermove',41,500-10*step,200);await finger('pointermove',42,560+10*step,200);}
 await page.waitForTimeout(300);const pinched=await camera(),half=(fov:number)=>Math.tan(fov*Math.PI/360);
 expect(half(pinched.fov)/half(before.fov),JSON.stringify({before,pinched})).toBeCloseTo(1/3,2);
 expect(Math.abs(await page.evaluate(()=>(window as any).__game.state().camera.viewYaw as number)-beforeYaw)).toBeLessThan(.01);
 await finger('pointerup',42,620,200);await finger('pointermove',41,380,200);await finger('pointermove',41,300,200);await page.waitForTimeout(300);
 expect(Math.abs(await page.evaluate(()=>(window as any).__game.state().camera.viewYaw as number)-beforeYaw)).toBeGreaterThan(.01);
 expect((await camera()).fov).toBeCloseTo(pinched.fov,6);await finger('pointerup',41,300,200);
 // Aim again lets the scope go and the on-foot buttons come back.
 await page.locator('.touch-button.aim').dispatchEvent('pointerdown',{pointerType:'touch'});
 await expect.poll(async()=>(await camera()).firstPerson,{timeout:5000}).toBeFalsy();await expect(controls).toHaveAttribute('data-mode','foot');
 expect(errors).toEqual([]);
});
