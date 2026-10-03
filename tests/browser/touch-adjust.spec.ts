import {test,expect,devices,type Page,type CDPSession} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The touch settings' Adjust controls (the iOS and Android port's own): from the pause menu, a layout's buttons are
 * dragged by a finger (CDP touch events) where the thumbs want them and the one touched sized, Done keeps them for play and for the next visit,
 * each layout keeps its own, and Reset puts them back; a slider follows a finger; Resolution High sharpens the picture and Low softens it, and Adaptive resolution is kept; Visual effects Low thins the
 * clouds and drops the player's real-time shadow; Draw distance 0 draws fewer map models. */
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
  // The Controls panel stays open from the last visit to the menu.
  if(!await page.locator('.touch-settings').isVisible())await page.getByRole('button',{name:'Controls',exact:true}).click();
  await page.getByRole('button',{name:'Adjust controls',exact:true}).click();
  await expect(page.locator('.touch-adjust')).toBeVisible();};
 await openAdjust();
 // On foot: Fire dragged up and left by a finger follows it.
 await drag(cdp,await box(page,fire),{x:-120,y:-60});
 const moved=await box(page,fire);expect(moved.x-home.x).toBeCloseTo(-120,-1);expect(moved.y-home.y).toBeCloseTo(-60,-1);
 // The button touched is the one sized: Bigger twice makes Fire a fifth bigger, about its centre.
 const width=async()=>(await page.locator(fire).boundingBox())!.width,size=page.locator('.touch-adjust-size');
 await expect(size).toContainText('Fire');await expect(size.locator('output')).toHaveText('100%');const before=await width();
 for(let i=0;i<2;i++)await tap(cdp,await box(page,'.touch-adjust [aria-label=Bigger]'));
 await expect(size.locator('output')).toHaveText('120%');expect(await width()/before).toBeCloseTo(1.2,1);expect((await box(page,fire)).x).toBeCloseTo(moved.x,0);
 // Driving is its own layout: its buttons have not moved.
 await tap(cdp,await box(page,'.touch-adjust [data-layout=vehicle]'));await expect(size).toBeHidden();
 await expect(page.locator('.touch-button.gas:not([hidden])')).toBeVisible();
 expect(await page.locator('.touch-button.gas:not([hidden])').evaluate(b=>(b as HTMLElement).style.translate)).toBe('');
 // Done: back to the menu, the layout kept; playing, Fire is where it was put, and still fires.
 await tap(cdp,await box(page,'.touch-adjust button:text-is("Done")'));
 await expect(page.locator('.touch-adjust')).toBeHidden();await expect(page.getByRole('button',{name:'Resume game',exact:true})).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('grove-touch-v1')!).layout);
 expect(Object.keys(saved)).toEqual(['foot:fire']);expect(saved['foot:fire'][2]).toBe(1.2);
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(async()=>(await box(page,fire)).x,{timeout:10000}).toBeCloseTo(moved.x,0);
 // The next visit keeps it.
 await page.reload();await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await box(page,fire)).x,{timeout:30000}).toBeCloseTo(moved.x,0);
 // The phone's back button is Done: the menu comes back on the same page, the layout kept.
 await openAdjust();const url=page.url();await page.goBack();
 await expect(page.locator('.touch-adjust')).toBeHidden();await expect(page.getByRole('button',{name:'Resume game',exact:true})).toBeVisible();expect(page.url()).toBe(url);
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 // Reset puts on foot's buttons back.
 await openAdjust();
 await tap(cdp,await box(page,'.touch-adjust button:text-is("Reset")'));await tap(cdp,await box(page,'.touch-adjust button:text-is("Done")'));
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(async()=>(await box(page,fire)).x,{timeout:10000}).toBeCloseTo(home.x,0);
 expect(await page.locator(fire).evaluate(b=>(b as HTMLElement).style.scale)).toBe('');
 // Resolution High draws at the screen's density (up to twice the CSS pixel), Standard at one pixel per CSS pixel.
 const buffer=()=>page.evaluate(()=>{const c=document.querySelector('canvas.world')??document.querySelector('canvas')!,gl=(window as any).__game.render().renderer.getContext();return gl.drawingBufferWidth/c.clientWidth;});
 expect(await buffer()).toBe(1);
 await page.getByRole('button',{name:'Pause',exact:true}).dispatchEvent('pointerdown',{pointerType:'touch'});
 // The Controls panel stays open from the last visit to the menu.
 if(!await page.locator('.touch-settings').isVisible())await page.getByRole('button',{name:'Controls',exact:true}).click();
 // A finger drags a setting's slider along (the page's own pinch and double-tap zoom are off; a slider still slides).
 {const slider=page.locator('.touch-look-speed');await slider.scrollIntoViewIfNeeded();const b=(await slider.boundingBox())!,y=b.y+b.height/2,before=Number(await slider.inputValue());
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width*.2,y,id:4}]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width*(.2+.65*i/8),y,id:4}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>Number(await slider.inputValue())).toBeGreaterThan(before+.3);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grove-touch-v1')!).lookSpeed)).toBeGreaterThan(before+.3);}
 await page.getByLabel('Resolution',{exact:true}).selectOption('high');
 await expect.poll(buffer).toBeCloseTo(2,1);
 // Low draws three quarters of a pixel per CSS pixel, softer and quicker.
 await page.getByLabel('Resolution',{exact:true}).selectOption('low');await expect.poll(buffer).toBeCloseTo(.75,1);
 await page.getByLabel('Resolution',{exact:true}).selectOption('standard');await expect.poll(buffer).toBe(1);
 // Adaptive resolution (on by default) lowers it while the game falls behind (not measured under automation); off, kept.
 {const adaptive=page.getByLabel('Adaptive resolution',{exact:true});await expect(adaptive).toBeChecked();
  await adaptive.uncheck();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grove-touch-v1')!).dynamicResolution)).toBe(false);
  await adaptive.check();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grove-touch-v1')!).dynamicResolution)).toBe(true);
  expect(await buffer()).toBe(1);}
 // Visual effects (the port's) set the FX quality: Low keeps half the volumetric clouds, draws no plants and no
 // real-time shadow for the player; High, the default, all of them.
 const effects=page.getByLabel('Visual effects',{exact:true});await expect(effects).toHaveValue('high');
 const drawn=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {clouds:s.volumetricClouds.usedNum,shadow:s.nativeShadow.visible as boolean};});
 await effects.selectOption('low');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grove-touch-v1')!).effects)).toBe('low');
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(drawn,{timeout:10000}).toEqual({clouds:90,shadow:false});
 await page.getByRole('button',{name:'Pause',exact:true}).dispatchEvent('pointerdown',{pointerType:'touch'});
 if(!await page.locator('.touch-settings').isVisible())await page.getByRole('button',{name:'Controls',exact:true}).click();
 await effects.selectOption('high');await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(async()=>(await drawn()).clouds,{timeout:10000}).toBe(180);
 // Draw distance (the port's slider, 70 by default) brings the low-detail stand-ins nearer at 0: fewer map models drawn.
 const models=()=>page.evaluate(()=>(window as any).__game.state().visibleImportedInstances as number),full=await models();
 const reach=async(value:string)=>{await page.getByRole('button',{name:'Pause',exact:true}).dispatchEvent('pointerdown',{pointerType:'touch'});
  if(!await page.locator('.touch-settings').isVisible())await page.getByRole('button',{name:'Controls',exact:true}).click();
  const slider=page.getByLabel('Draw distance',{exact:true});await slider.fill(value);await slider.dispatchEvent('input');
  await page.getByRole('button',{name:'Resume game',exact:true}).click();};
 expect(await page.getByLabel('Draw distance',{exact:true}).inputValue()).toBe('70');
 await reach('0');await expect.poll(models,{timeout:10000}).toBeLessThan(full);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('grove-touch-v1')!).drawDistance)).toBe(0);
 await reach('70');await expect.poll(models,{timeout:10000}).toBe(full);
 expect(errors).toEqual([]);
});
