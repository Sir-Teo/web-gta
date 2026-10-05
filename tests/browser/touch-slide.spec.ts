import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A thumb rocked from Gas onto Brake brakes, as the mobile ports' pedals answer whichever widget a touch is over; one
 * that strays off the pedals into the open keeps the last one pressed. */
test.use({hasTouch:true});
test('a thumb slides from Gas to Brake and the car takes it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));await page.waitForTimeout(1000);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2491,g.groundAt(2491,1684,300)+.05,1684);g.turnPlayer(0);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 const finger=(selector:string,type:string,x:number,y:number,id:number)=>page.evaluate(({selector,type,x,y,id})=>{
  document.querySelector(selector)!.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
 },{selector,type,x,y,id});
 const centre=async(selector:string)=>{const b=(await page.locator(selector).boundingBox())!;return {x:b.x+b.width/2,y:b.y+b.height/2};};
 const enter=await centre('.touch-button.enter:not([hidden])');
 await finger('.touch-button.enter:not([hidden])','pointerdown',enter.x,enter.y,3);await finger('.touch-button.enter:not([hidden])','pointerup',enter.x,enter.y,3);
 await expect.poll(async()=>(await state()).carEntry.phase,{timeout:60000}).toBe('seated');
 const choice=page.locator('.touch-steering-choice button[data-steering="stick"]');if(await choice.isVisible())await choice.dispatchEvent('pointerup');
 const gas='.touch-button.gas:not([hidden])',brake='.touch-button.reverse:not([hidden])';
 const g=await centre(gas),b=await centre(brake);
 // Gas held by finger 5 drives forward.
 await finger(gas,'pointerdown',g.x,g.y,5);
 await expect.poll(async()=>(await state()).nativeCar.gas,{timeout:5000}).toBeGreaterThan(0);
 await expect(page.locator(gas)).toHaveClass(/\bon\b/);
 // The same finger slides onto Brake (a captured pointer's moves go to the button it went down on).
 await finger(gas,'pointermove',(g.x+b.x)/2,g.y,5);await finger(gas,'pointermove',b.x,b.y,5);
 await expect(page.locator(brake)).toHaveClass(/\bon\b/);await expect(page.locator(gas)).not.toHaveClass(/\bon\b/);
 await expect.poll(async()=>(await state()).nativeCar.gas,{timeout:5000}).toBeLessThanOrEqual(0);
 // Off the pedals into the open, Brake stays pressed; lifted, nothing is.
 await finger(gas,'pointermove',b.x-200,b.y-150,5);
 await expect(page.locator(brake)).toHaveClass(/\bon\b/);
 await finger(gas,'pointerup',b.x-200,b.y-150,5);
 await expect(page.locator(brake)).not.toHaveClass(/\bon\b/);
 await expect.poll(async()=>(await state()).nativeCar.gas,{timeout:5000}).toBe(0);
 expect(errors).toEqual([]);
});
