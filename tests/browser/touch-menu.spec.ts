import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A phone held sideways is short: the pause menu's pages (Controls, Display, Audio, Brief) open beside its list, one at a time,
 * each scrolling in its own column, as the port's menu shows its settings, rather than under the list and off the
 * bottom of the screen; and a tapped button lights while pressed, without the browser's tap flash, and does not stay lit
 * as if hovered once its page is closed. */
test.use({viewport:{width:667,height:375},hasTouch:true,isMobile:true});
test('a short phone\'s menu opens its pages beside the list, one at a time',async({page})=>{
 test.setTimeout(150000);
 await page.goto('/?touch=1');
 await expect(page.locator('.menu-message')).toContainText('Your left thumb walks',{timeout:120000});
 const controls=page.getByRole('button',{name:'Controls',exact:true}),audio=page.getByRole('button',{name:'Audio',exact:true});
 await controls.tap();
 const panel=page.locator('.controls-panel'),box=async(selector:string)=>(await page.locator(selector).boundingBox())!;
 await expect(panel).toBeVisible();await expect(controls).toHaveAttribute('aria-expanded','true');
 // Beside the buttons and on the screen: the settings scroll inside it, down to Adjust controls.
 const list=await box('.menu-actions'),page1=await box('.controls-panel');
 expect(page1.x).toBeGreaterThanOrEqual(list.x+list.width);expect(page1.y+page1.height).toBeLessThanOrEqual(375);
 expect(await panel.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
 const adjust=page.getByRole('button',{name:'Adjust controls',exact:true});await adjust.scrollIntoViewIfNeeded();
 const a=(await adjust.boundingBox())!;expect(a.y+a.height).toBeLessThanOrEqual(375);
 // The list stays put while its page scrolls.
 expect((await box('.menu-actions')).y).toBeCloseTo(list.y,0);
 // Display (the PC's Display Setup) takes the page's place: the graphics settings, the frame limiter and the radar.
 const display=page.getByRole('button',{name:'Display',exact:true});await display.tap();
 await expect(panel).toBeHidden();await expect(page.locator('.display-panel')).toBeVisible();
 for(const label of ['Resolution','Visual effects','Shadows','Radar'])await expect(page.getByLabel(label,{exact:true})).toBeAttached();
 // Audio takes the page's place.
 await audio.tap();await expect(page.locator('.display-panel')).toBeHidden();await expect(page.locator('.audio-panel')).toBeVisible();
 await expect(controls).toHaveAttribute('aria-expanded','false');await expect(audio).toHaveAttribute('aria-expanded','true');
 // Pressed, a button lights (no hover on a finger, and no browser flash); closed, once the finger is up, it is lit no
 // more than its neighbour, though the browser still counts it hovered.
 const colour=(button:typeof audio)=>button.evaluate(e=>getComputedStyle(e).color);
 expect(await audio.evaluate(e=>getComputedStyle(e).getPropertyValue('-webkit-tap-highlight-color'))).toBe('rgba(0, 0, 0, 0)');
 await audio.tap();await expect(page.locator('.audio-panel')).toBeHidden();await expect(audio).toHaveAttribute('aria-expanded','false');
 await expect.poll(()=>colour(audio)).toBe(await colour(controls));expect(await audio.evaluate(e=>e.matches(':hover'))).toBe(true);
});

test('a shop\'s script menu on a short phone stands clear of the pause button under the radar',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // A shop's menu where the scripts put theirs, (29, 145) of 640 x 448: over the pause button on a phone.
 const menuId=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling().runtime.game.menus,id=m.create(0,'SHOP',29,145,180,1,true,true,0);
  for(const [row,text] of ['ROW_A','ROW_B','ROW_C'].entries())m.insertOneMenuItemWithNumber(id,0,row,text,-1,-1);m.activateItems(id,[true,true,true]);return id as number;});
 await expect(page.locator('.script-menu-box')).toBeVisible();
 const pause=page.getByRole('button',{name:'Pause',exact:true});await expect(pause).toBeVisible();
 const clear=()=>page.evaluate(()=>{const p=document.querySelector('.touch-top .pause')!.getBoundingClientRect();
  return [...document.querySelectorAll('.script-menus > *')].map(e=>e.getBoundingClientRect()).every(b=>b.left>=p.right||b.right<=p.left||b.top>=p.bottom||b.bottom<=p.top);});
 await expect.poll(clear).toBe(true);
 // Its rows still take taps where they now stand.
 const row=page.locator('.script-menu-text',{hasText:'ROW_B'});const r=(await row.boundingBox())!;
 await page.evaluate(({x,y})=>{const t=document.elementFromPoint(x,y)!;for(const type of ['pointerdown','pointerup'])t.dispatchEvent(new PointerEvent(type,{pointerId:3,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));},{x:r.x+r.width/2,y:r.y+r.height/2});
 await expect.poll(()=>page.evaluate(id=>(window as any).__game.missionForProfiling().runtime.game.menus.checkForSelected(id),menuId),{timeout:5000}).toBe(1);
});

test('a mission\'s timer on a short phone hangs under the money and health, clear of the buttons and CJ',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await page.evaluate(()=>{const t=(window as any).__game.missionForProfiling().runtime.game.onscreenTimer;t.addClock(9000,'BB_19',125000);t.addCounter(9004,0,'KILLS',0);});
 const timers=page.locator('.mission-timers');await expect(timers).toBeVisible();
 const placed=await page.evaluate(()=>{const t=document.querySelector('.mission-timers')!.getBoundingClientRect(),status=document.querySelector('.status')!.getBoundingClientRect();
  const buttons=[...document.querySelectorAll('.touch-controls .touch-button:not([hidden])')].map(b=>b.getBoundingClientRect()).filter(r=>r.width);
  return {top:t.top,bottom:t.bottom,statusBottom:status.bottom,height:innerHeight,overlaps:buttons.filter(b=>b.left<t.right&&b.right>t.left&&b.top<t.bottom&&b.bottom>t.top).length,font:parseFloat(getComputedStyle(document.querySelector('.mission-timers')!).fontSize)};});
 // Under the HUD's status, in the top half of the screen (not 228 px down, the middle of a sideways phone), at a size
 // by the screen's height, and over no button.
 expect(placed.top).toBeGreaterThanOrEqual(placed.statusBottom);expect(placed.bottom).toBeLessThan(placed.height/2);
 expect(placed.overlaps).toBe(0);expect(placed.font).toBeLessThan(24);
});

test('MISSION FAILED! at the top of a short phone stands under the money and health, not over them',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await page.evaluate(()=>{const g=(window as any).__game.missionForProfiling().runtime.game;g.messages.addBigMessage2('M_FAIL',8000,6,true,performance.now());});
 const top=page.locator('.light-blue-top');await expect(top).toBeVisible();await expect(top).toContainText('MISSION FAILED');
 expect(await page.evaluate(()=>{const m=document.querySelector('.light-blue-top')!.getBoundingClientRect();
  return [...document.querySelectorAll('.status > *')].map(e=>e.getBoundingClientRect()).filter(r=>r.width).every(r=>r.right<=m.left||r.left>=m.right||r.bottom<=m.top||r.top>=m.bottom);})).toBe(true);
});
