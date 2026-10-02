import {test,expect,devices,type Page,type CDPSession} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The touch settings' Adjust controls (the iOS and Android port's own): from the pause menu, a layout's buttons are
 * dragged by a finger (CDP touch events) where the thumbs want them, Done keeps them for play and for the next visit,
 * each layout keeps its own, and Reset puts them back; Resolution High sharpens the picture. */
const {defaultBrowserType,...phone}=devices['Pixel 7 landscape'];
test.use({...phone});
/** An element's centre, once it is on screen (the controls come back a frame after a menu closes). */
const box=async(page:Page,selector:string)=>{const target=page.locator(selector).first();await target.waitFor({state:'visible',timeout:10000});const b=(await target.boundingBox())!;return {x:b.x+b.width/2,y:b.y+b.height/2};};
const drag=async(cdp:CDPSession,from:{x:number;y:number},by:{x:number;y:number})=>{
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});
 for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+by.x*i/6,y:from.y+by.y*i/6,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
};
const tap=async(cdp:CDPSession,at:{x:number;y:number})=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...at,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
test('a phone moves its buttons where the thumbs want them and keeps them',async({page,context})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!localStorage.getItem('grove-touch-v1'))localStorage.setItem('grove-touch-v1',JSON.stringify({steering:'stick'}));});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const cdp=await context.newCDPSession(page),fire='.touch-button.fire:not([hidden])';
 const home=await box(page,fire);
 const openAdjust=async()=>{await page.getByRole('button',{name:'Pause',exact:true}).dispatchEvent('pointerdown',{pointerType:'touch'});
  await page.getByRole('button',{name:'Controls',exact:true}).click();await page.getByRole('button',{name:'Adjust controls',exact:true}).click();
  await expect(page.locator('.touch-adjust')).toBeVisible();};
 await openAdjust();
 // On foot: Fire dragged up and left by a finger follows it.
 await drag(cdp,await box(page,fire),{x:-120,y:-60});
 const moved=await box(page,fire);expect(moved.x-home.x).toBeCloseTo(-120,-1);expect(moved.y-home.y).toBeCloseTo(-60,-1);
 // Driving is its own layout: its buttons have not moved.
 await tap(cdp,await box(page,'.touch-adjust [data-layout=vehicle]'));
 await expect(page.locator('.touch-button.gas:not([hidden])')).toBeVisible();
 expect(await page.locator('.touch-button.gas:not([hidden])').evaluate(b=>(b as HTMLElement).style.translate)).toBe('');
 // Done: back to the menu, the layout kept; playing, Fire is where it was put, and still fires.
 await tap(cdp,await box(page,'.touch-adjust button:text-is("Done")'));
 await expect(page.locator('.touch-adjust')).toBeHidden();await expect(page.getByRole('button',{name:'Resume game',exact:true})).toBeVisible();
 expect(Object.keys(await page.evaluate(()=>JSON.parse(localStorage.getItem('grove-touch-v1')!).layout))).toEqual(['foot:fire']);
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(async()=>(await box(page,fire)).x,{timeout:10000}).toBeCloseTo(moved.x,0);
 // The next visit keeps it.
 await page.reload();await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await box(page,fire)).x,{timeout:30000}).toBeCloseTo(moved.x,0);
 // Reset puts on foot's buttons back.
 await openAdjust();
 await tap(cdp,await box(page,'.touch-adjust button:text-is("Reset")'));await tap(cdp,await box(page,'.touch-adjust button:text-is("Done")'));
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(async()=>(await box(page,fire)).x,{timeout:10000}).toBeCloseTo(home.x,0);
 // Resolution High draws at the screen's density (up to twice the CSS pixel), Standard at one pixel per CSS pixel.
 const buffer=()=>page.evaluate(()=>{const c=document.querySelector('canvas.world')??document.querySelector('canvas')!,gl=(window as any).__game.render().renderer.getContext();return gl.drawingBufferWidth/c.clientWidth;});
 expect(await buffer()).toBe(1);
 await page.getByRole('button',{name:'Pause',exact:true}).dispatchEvent('pointerdown',{pointerType:'touch'});
 // The Controls panel stays open from the last visit to the menu.
 if(!await page.locator('.touch-settings').isVisible())await page.getByRole('button',{name:'Controls',exact:true}).click();
 await page.getByLabel('Resolution',{exact:true}).selectOption('high');
 await expect.poll(buffer).toBeCloseTo(2,1);
 await page.getByLabel('Resolution',{exact:true}).selectOption('standard');await expect.poll(buffer).toBe(1);
 expect(errors).toEqual([]);
});
