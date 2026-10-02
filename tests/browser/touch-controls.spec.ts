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
 // The script reads the stick as the pad's left stick, pushed up.
 const pad=()=>page.evaluate(()=>{const p=(window as any).__game.missionForProfiling().runtime.game.pads.pads[0];return {x:p.leftStickX,y:p.leftStickY,yes:p.dpadRight};});
 await expect.poll(async()=>(await pad()).y,{timeout:5000}).toBeLessThan(-100);
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
 // The HUD's weapon icon is the weapon button: a tap takes the next weapon, a swipe to the left the one before.
 const selected=()=>page.evaluate(()=>(window as any).__game.weapons().inventory.selected as number);
 const slot=(await page.locator('.weapon-slot').boundingBox())!,sx=slot.x+slot.width/2,sy=slot.y+slot.height/2;
 const tapIcon=async(id:number,dx=0)=>{const before=await selected();await finger('.weapon-slot','pointerdown',sx,sy,id);await finger('.weapon-slot','pointerup',sx+dx,sy,id);
  await expect.poll(selected,{timeout:5000}).not.toBe(before);return selected();};
 const one=await tapIcon(51);await tapIcon(52);expect(await tapIcon(53,-60)).toBe(one);
 // The Fire button shows the weapon in hand, the HUD icon's own picture.
 await page.evaluate(()=>(window as any).__game.weapons().inventory.select(30));
 await expect.poll(()=>page.evaluate(()=>{const hud=document.querySelector<HTMLImageElement>('.weapon-slot img.native-weapon-icon'),fire=document.querySelector<HTMLImageElement>('.touch-button.fire:not([hidden]) img');
  return !!hud&&!hud.hidden&&!!fire&&fire.src===hud.src;}),{timeout:10000}).toBe(true);
 // The weapon icon held opens the arsenal (and steps no weapon), without raising the on-screen keyboard: the close
 // button has the focus, not the search.
 const held=await selected();await finger('.weapon-slot','pointerdown',sx,sy,54);await page.waitForTimeout(800);await finger('.weapon-slot','pointerup',sx,sy,54);
 await expect(page.locator('.arsenal')).toBeVisible();await expect(controls).toBeHidden();expect(await selected()).toBe(held);
 expect(await page.evaluate(()=>document.activeElement?.className)).toBe('arsenal-close');
 await page.locator('.arsenal-close').click();await expect(controls).toBeVisible();
 // The radar, in the top left corner as in the mobile ports, opens the map: the hint speaks to a finger, and a tap sets
 // the waypoint.
 const radar=(await page.locator('.minimap-button').boundingBox())!;expect(radar.y).toBeLessThan(page.viewportSize()!.height/3);
 await page.locator('.minimap-button').tap();
 await expect(page.locator('.map-status')).toContainText('Pinch zooms');
 await page.locator('.world-map-panel canvas').tap({position:{x:100,y:100}});await expect(page.locator('.map-status')).toContainText('Waypoint');
 await page.locator('.map-close').click();await expect(controls).toBeVisible();
 // A help line that asks for a control with no button of its own names the touch one and puts a button up for it,
 // which reaches the script's pad; it goes when the help does.
 await page.evaluate(async()=>{const gxt='/src/assets/gxt.ts',{gxtHudText}=await import(gxt);(window as any).__game.hud().help(gxtHudText('Press ~k~~CONVERSATION_YES~ to agree.'),60000);});
 await expect(page.locator('.help-box')).toHaveText('Press YES to agree.');
 const yes=page.locator('.touch-context button',{hasText:'Yes'});await expect(yes).toBeVisible();
 const yesBox=(await yes.boundingBox())!;
 await page.evaluate(({x,y})=>document.querySelector('.touch-context button[data-code=KeyY]')!.dispatchEvent(new PointerEvent('pointerdown',{pointerId:21,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),{x:yesBox.x+5,y:yesBox.y+5});
 await expect.poll(async()=>(await pad()).yes,{timeout:5000}).toBe(255);
 await page.evaluate(({x,y})=>document.querySelector('.touch-context button[data-code=KeyY]')!.dispatchEvent(new PointerEvent('pointerup',{pointerId:21,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),{x:yesBox.x+5,y:yesBox.y+5});
 await page.evaluate(()=>(window as any).__game.hud().help(''));await expect(yes).toBeHidden();
 // A script menu (a shop's) puts up the port's arrows with Select and Back, which drive the menu through the pad.
 const menuId=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling().runtime.game.menus,id=m.create(0,'SHOP',29,145,180,1,true,true,0);
  for(const [row,text] of ['ROW_A','ROW_B','ROW_C'].entries())m.insertOneMenuItemWithNumber(id,0,row,text,-1,-1);m.activateItems(id,[true,true,true]);return id;});
 const menu=()=>page.evaluate(id=>{const m=(window as any).__game.missionForProfiling().runtime.game.menus;return {selected:m.checkForSelected(id),accepted:m.checkForAccept(id)};},menuId);
 const down=page.locator('.touch-context button[data-code=MenuDown]'),select=page.locator('.touch-context button[data-code=MenuSelect]');
 await expect(down).toBeVisible();await expect(select).toBeVisible();await expect(page.locator('.touch-context button[data-code=MenuLeft]')).toBeHidden();
 const tapContext=async(code:string,id:number)=>{for(const type of ['pointerdown','pointerup'])await page.evaluate(({code,type,id})=>{const b=document.querySelector(`.touch-context button[data-code=${code}]`)!,r=b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:r.x+5,clientY:r.y+5,bubbles:true,cancelable:true}));},{code,type,id});};
 const start=(await menu()).selected;
 await tapContext('MenuDown',61);
 await expect.poll(async()=>(await menu()).selected,{timeout:5000}).toBe(start+1);
 // Held, Select accepts the highlighted row.
 await page.evaluate(()=>{const b=document.querySelector('.touch-context button[data-code=MenuSelect]')!,r=b.getBoundingClientRect();b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:62,pointerType:'touch',clientX:r.x+5,clientY:r.y+5,bubbles:true,cancelable:true}));});
 await expect.poll(async()=>(await menu()).accepted,{timeout:5000}).toBe(start+1);
 await page.evaluate(()=>{const b=document.querySelector('.touch-context button[data-code=MenuSelect]')!,r=b.getBoundingClientRect();b.dispatchEvent(new PointerEvent('pointerup',{pointerId:62,pointerType:'touch',clientX:r.x+5,clientY:r.y+5,bubbles:true,cancelable:true}));});
 // The menu's own lines take taps: one lights a line, another on it chooses it; and the buttons sit under the left thumb.
 await expect(page.locator('.touch-controls')).toHaveAttribute('data-menu','on');
 const tapRow=(text:string,id:number)=>page.evaluate(({text,id})=>{const t=[...document.querySelectorAll<HTMLElement>('.script-menu-text')].find(e=>e.textContent===text)!,r=t.getBoundingClientRect();
  for(const type of ['pointerdown','pointerup'])t.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true,cancelable:true}));},{text,id});
 await page.waitForTimeout(300);await tapRow('ROW_A',63);await expect.poll(async()=>(await menu()).selected,{timeout:5000}).toBe(0);
 await tapRow('ROW_A',64);await expect.poll(async()=>(await menu()).accepted,{timeout:5000}).toBe(0);
 await page.evaluate(id=>(window as any).__game.missionForProfiling().runtime.game.menus.switchOff(id),menuId);await expect(down).toBeHidden();
 await expect(page.locator('.touch-controls')).not.toHaveAttribute('data-menu','on');
 // Sideways there is no card; a phone turned upright gets one until it turns back or the player plays on anyway.
 const rotate=page.locator('.touch-rotate');await expect(rotate).toBeHidden();
 const viewport=page.viewportSize()!;await page.setViewportSize({width:390,height:844});
 await expect(rotate).toBeVisible();await rotate.locator('button').dispatchEvent('pointerdown',{pointerType:'touch'});await expect(rotate).toBeHidden();
 await page.setViewportSize(viewport);
 // ☰ pauses, and the overlay gives way to the menu.
 await page.getByRole('button',{name:'Pause',exact:true}).dispatchEvent('pointerdown',{pointerType:'touch'});
 await expect(controls).toBeHidden();
 // The pause menu's Controls panel holds the touch settings in place of the key list: a bigger button size takes.
 await page.getByRole('button',{name:'Controls',exact:true}).click();
 await expect(page.locator('.touch-settings')).toBeVisible();await expect(page.getByLabel('Steering',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Population',{exact:true})).toHaveValue('medium');
 await page.getByLabel('Button size',{exact:true}).fill('1.2');
 expect(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--touch-scale'))).toBe('1.2');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('grove-touch-v1')!).buttonScale)).toBe(1.2);
 // Invert look turns the drag's vertical look over (the mouse's own setting is hidden on a touch screen).
 expect(await page.evaluate(()=>(window as any).__game.render().mouseYSign)).toBe(1);
 await page.getByLabel('Invert look',{exact:true}).check();
 expect(await page.evaluate(()=>(window as any).__game.render().mouseYSign)).toBe(-1);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('grove-touch-v1')!).invertLook)).toBe(true);
 // Steering by the arrows: help text names them for a car's left and right.
 await page.getByLabel('Steering',{exact:true}).selectOption('arrows');
 expect(await page.evaluate(async()=>{const gxt='/src/assets/gxt.ts',{gxtHudText}=await import(gxt);return gxtHudText('~k~~VEHICLE_STEERLEFT~ and ~k~~VEHICLE_STEERRIGHT~ steer.');})).toBe('the ARROWS steer.');
 expect(errors).toEqual([]);
});
