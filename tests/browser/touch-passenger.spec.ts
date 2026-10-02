import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A passenger seat on a phone (WARP_CHAR_INTO_CAR_AS_PASSENGER, a mission's ride): the driver's Gas, Brake, H-brake and
 * Horn go, and no steering question or Mission button comes up in someone else's police car; Fire, Look, Radio and
 * Enter (to get out) stay. */
test.use({hasTouch:true});
test('a phone passenger has no pedals, wheel or horn, and gets out with Enter',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(596,{x:p.x+6,y:-p.z+7,z:-100},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 await page.waitForFunction(c=>(window as any).__game.missionForProfiling().vehicles.positionOf(c).z>-50,car,{timeout:30000});
 await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCarAsPassenger(1,c,0),car);
 const controls=page.locator('.touch-controls');await expect(controls).toHaveAttribute('data-mode','vehicle');
 const shown=(label:string)=>page.locator(`.touch-button[aria-label="${label}"]:not([hidden])`);
 for(const label of ['Gas','Brake','H-brake','Horn'])await expect(shown(label)).toHaveCount(0);
 for(const label of ['Fire','Look','Radio','Enter'])await expect(shown(label)).toHaveCount(1);
 await expect(page.getByRole('dialog',{name:'Choose steering'})).toBeHidden();
 await expect(page.locator('.touch-context button[data-code=Digit2]:not([hidden])')).toHaveCount(0);
 // Enter gets the passenger out, and on foot the controls are the walker's again.
 const enter=(await shown('Enter').boundingBox())!;
 for(const type of ['pointerdown','pointerup'])await page.evaluate(({type,x,y})=>document.querySelector('.touch-button.enter:not([hidden])')!.dispatchEvent(new PointerEvent(type,{pointerId:31,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),{type,x:enter.x+enter.width/2,y:enter.y+enter.height/2});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)??null),{timeout:20000}).toBeNull();
 await expect(controls).toHaveAttribute('data-mode','foot');await expect(shown('Jump')).toHaveCount(1);
 expect(errors).toEqual([]);
});
