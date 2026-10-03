import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A phone put down mid-game keeps its screen on only so long: untouched (no finger on the glass, nothing pressed) past
 * the idle time, the game lets the screen wake lock go so the phone dims and locks on its own time, and a touch takes it
 * again. A thumb resting on the glass is play. The idle time is five minutes; the test shortens it. */
test.use({hasTouch:true,viewport:{width:844,height:390}});
test('a phone left untouched mid-game lets its screen go dark, and a touch keeps it on again',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const log:string[]=[];(window as any).__wakeLog=log;
  Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{log.push('request');const s={released:false,release:async()=>{s.released=true;log.push('release');}};return s;}}});});
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const awake=(ms?:number)=>page.evaluate(ms=>(window as any).__game.screenAwake(ms),ms);
 await expect.poll(async()=>(await awake()).held).toBe(true);
 // Untouched past the (shortened) idle time: the lock goes.
 await awake(1500);await expect.poll(async()=>(await awake()).held,{timeout:10000}).toBe(false);
 expect((await awake()).idled).toBe(true);
 // A touch takes it again.
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:600,y:150,id:3}]});
 await expect.poll(async()=>(await awake()).held,{timeout:5000}).toBe(true);
 // A finger resting on the glass (a thumb on the gas) keeps it on, however long nothing new is touched.
 await page.waitForTimeout(3000);expect(await awake()).toMatchObject({held:true,idled:false,fingers:1});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(async()=>(await awake()).held,{timeout:10000}).toBe(false);
 // Under the pause menu the lock is let go as before, and resuming takes it again.
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Resume game',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(async()=>(await awake()).held,{timeout:5000}).toBe(true);
 expect(errors).toEqual([]);
});
