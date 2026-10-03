import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A call, Siri or an alarm suspends a phone browser's audio mid-game, and the browser does not always start it again
 * (nor lets the page, outside a gesture): the game's sound comes back with the next touch, as the port's own comes back
 * when the interruption ends. The system's suspension is stood in for by suspending the game's context from outside. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('the sound a call suspended comes back with the next touch',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Base=window.AudioContext;(window as any).AudioContext=class extends Base{constructor(options?:AudioContextOptions){super(options);(window as any).__context=this;}};});
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const context=()=>page.evaluate(()=>(window as any).__game.state().audio.context as string);
 await expect.poll(context,{timeout:15000}).toBe('running');
 // The interruption: the context is held, and stays so on its own.
 await page.evaluate(()=>(window as any).__context.suspend());
 await expect.poll(context).toBe('suspended');await page.waitForTimeout(1000);expect(await context()).toBe('suspended');
 // A touch on the open screen (a look drag's start) starts it again.
 await page.touchscreen.tap(560,120);
 await expect.poll(context,{timeout:5000}).toBe('running');
 // The game's own pause still suspends it, and a touch on the menu does not start it.
 await page.getByRole('button',{name:'Pause',exact:true}).dispatchEvent('pointerdown',{pointerType:'touch'});
 await expect.poll(context).toBe('suspended');await page.touchscreen.tap(560,300);await page.waitForTimeout(500);expect(await context()).toBe('suspended');
 expect(errors).toEqual([]);
});
