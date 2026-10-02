import {test,expect,devices} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A game controller on a phone (the Gamepad API, a standard-mapping pad stood in for here, its state set by the test):
 * the left stick walks CJ and cross sprints, as on the PS2's pad; the touch buttons stand aside while it plays and come
 * back at a touch, and help names its buttons meanwhile; Start pauses, the D-pad and cross work the menu, and Start plays
 * on. */
const {defaultBrowserType,...phone}=devices['Pixel 7 landscape'];
test.use({...phone});
test('a controller plays on a phone and works the pause menu',async({page,context})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const w=window as any;
  w.__pad={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[w.__pad]});
  localStorage.setItem('grove-touch-v1',JSON.stringify({steering:'stick'}));});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const button=(index:number,on:boolean)=>page.evaluate(({index,on})=>{(window as any).__pad.buttons[index]={pressed:on,value:on?1:0};},{index,on});
 const stick=(x:number,y:number)=>page.evaluate(({x,y})=>{(window as any).__pad.axes=[x,y,0,0];},{x,y});
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2495,g.groundAt(2495,1687,300)+.05,1687);g.turnPlayer(Math.PI);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await expect(page.locator('.touch-controls')).toBeVisible();
 // The left stick pushed forward walks CJ off; the touch buttons give way to the pad.
 const before=(await state()).player.position;await stick(0,-1);
 await expect.poll(async()=>{const p=(await state()).player.position;return Math.hypot(p.x-before.x,p.z-before.z);},{timeout:20000}).toBeGreaterThan(1.5);
 await expect(page.locator('.touch-controls')).toBeHidden();
 // Help names the pad's buttons while it plays (the stand-in names no maker, so the Xbox letters).
 const named=()=>page.evaluate(async()=>{const gxt='/src/assets/gxt.ts',{gxtHudText}=await import(gxt);return gxtHudText('Press ~k~~VEHICLE_ENTER_EXIT~ to get in.') as string;});
 await expect.poll(named).toBe('Press Y to get in.');
 // The help box draws the pad's buttons: a face button as its own symbol in its colour, a shoulder as a chip, the D-pad
 // as its arrow.
 await page.evaluate(async()=>{const gxt='/src/assets/gxt.ts',{gxtHudText}=await import(gxt);(window as any).__game.hud().help(gxtHudText('Press ~k~~VEHICLE_ENTER_EXIT~ to get in, ~k~~PED_LOCK_TARGET~ to aim and ~k~~GROUP_CONTROL_FWD~ to recruit.'),60000);});
 await expect(page.locator('.help-box .help-key.pad')).toHaveText(['Y','RB','▲']);await expect(page.locator('.help-box')).toContainText('Press Y to get in, RB to aim and');
 await page.evaluate(()=>(window as any).__game.hud().help(''));
 // Cross held sprints.
 await button(0,true);await expect.poll(async()=>(await state()).nativeCharacter?.action,{timeout:10000}).toBe('sprint');
 await button(0,false);await stick(0,0);
 // Start pauses; the D-pad moves along the menu and cross presses: Controls opens its panel.
 await button(9,true);await expect.poll(async()=>(await state()).paused).toBe(true);await button(9,false);
 for(let i=0;i<8&&!(await page.evaluate(()=>document.activeElement?.textContent==='Controls'));i++){await button(13,true);await page.waitForTimeout(250);await button(13,false);await page.waitForTimeout(250);}
 await expect(page.getByRole('button',{name:'Controls',exact:true})).toBeFocused();
 await button(0,true);await expect(page.locator('.touch-settings')).toBeVisible();await button(0,false);
 // Start plays on.
 await page.waitForTimeout(300);await button(9,true);await expect.poll(async()=>(await state()).paused).toBe(false);await button(9,false);
 // A touch on the screen brings the touch buttons back.
 const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:600,y:150,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.locator('.touch-controls')).toBeVisible();await expect.poll(named).toBe('Press ENTER to get in.');
 expect(errors).toEqual([]);
});
