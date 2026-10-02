import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A phone's controls: starting goes fullscreen, the stick under the left thumb walks CJ, a drag on the right turns the camera, and the Jump
 * button jumps; the overlay hides under the pause menu. */
test.use({hasTouch:true});
test('touch controls move CJ, turn the camera and press the game\'s buttons',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const controls=page.locator('.touch-controls');await expect(controls).toBeVisible();
 // The menu's tap took the page fullscreen, out from under the browser's bars.
 expect(await page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 // Pointer events as a finger sends them, at an element's point.
 const finger=(selector:string,type:string,x:number,y:number,id=7)=>page.evaluate(({selector,type,x,y,id})=>{
  document.querySelector(selector)!.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
 },{selector,type,x,y,id});
 const zone=(await page.locator('.touch-stick-zone').boundingBox())!;
 const before=(await state()).player.position;
 const x=zone.x+zone.width/2,y=zone.y+zone.height/2;
 await finger('.touch-stick-zone','pointerdown',x,y);await finger('.touch-stick-zone','pointermove',x,y-70);
 await expect(page.locator('.touch-stick')).toBeVisible();
 await expect.poll(async()=>{const p=(await state()).player.position;return Math.hypot(p.x-before.x,p.z-before.z);},{timeout:20000}).toBeGreaterThan(1.5);
 await finger('.touch-stick-zone','pointerup',x,y-70);
 await expect(page.locator('.touch-stick')).toBeHidden();
 // The right side turns the camera.
 const look=(await page.locator('.touch-look').boundingBox())!,yaw=(await state()).camera.yaw;
 await finger('.touch-look','pointerdown',look.x+look.width/2,look.y+look.height/2,9);
 for(let i=1;i<=5;i++)await finger('.touch-look','pointermove',look.x+look.width/2+i*30,look.y+look.height/2,9);
 await finger('.touch-look','pointerup',look.x+look.width/2+150,look.y+look.height/2,9);
 await expect.poll(async()=>Math.abs((await state()).camera.yaw-yaw),{timeout:10000}).toBeGreaterThan(.05);
 // Jump holds Space: CJ leaves the ground.
 const jump=page.locator('.touch-button.jump:not([hidden])');
 const box=(await jump.boundingBox())!;
 await finger('.touch-button.jump:not([hidden])','pointerdown',box.x+box.width/2,box.y+box.height/2,11);
 await expect.poll(async()=>(await state()).player.grounded,{timeout:5000}).toBe(false);
 await finger('.touch-button.jump:not([hidden])','pointerup',box.x+box.width/2,box.y+box.height/2,11);
 // ☰ pauses, and the overlay gives way to the menu.
 await page.locator('.touch-top .touch-button').first().dispatchEvent('pointerdown',{pointerType:'touch'});
 await expect(controls).toBeHidden();
 expect(errors).toEqual([]);
});
