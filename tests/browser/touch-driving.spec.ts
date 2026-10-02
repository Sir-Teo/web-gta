import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** At the wheel the touch controls give the right thumb Gas and Brake: the stick held hard to one side (no push
 * forward at all) steers while Gas drives, so the car turns at full lock under power, and Brake stops it. */
test.use({hasTouch:true});
test('a phone drives with the stick at full lock and the Gas pedal',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const clock=()=>page.evaluate(()=>(window as any).__game.gameTimeMs()/1000);
 const gameWait=async(s:number)=>{const t0=await clock();await expect.poll(clock,{timeout:60000}).toBeGreaterThan(t0+s);};
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));await gameWait(.5);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2491,g.groundAt(2491,1684,300)+.05,1684);g.turnPlayer(0);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);await gameWait(.5);
 const finger=(selector:string,type:string,x:number,y:number,id:number)=>page.evaluate(({selector,type,x,y,id})=>{
  document.querySelector(selector)!.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
 },{selector,type,x,y,id});
 const press=async(selector:string,id:number,type='pointerdown')=>{const b=(await page.locator(selector).boundingBox())!;await finger(selector,type,b.x+b.width/2,b.y+b.height/2,id);};
 await press('.touch-button.enter:not([hidden])',3);await press('.touch-button.enter:not([hidden])',3,'pointerup');
 await expect.poll(async()=>(await state()).carEntry.phase,{timeout:60000}).toBe('seated');
 await expect(page.locator('.touch-controls')).toHaveAttribute('data-mode','vehicle');
 await expect(page.locator('.touch-button.gas:not([hidden])')).toBeVisible();await expect(page.locator('.touch-button.aim')).toBeHidden();
 // Radio tunes the next station, named at the top of the screen.
 await press('.touch-button.radio',13);await press('.touch-button.radio',13,'pointerup');
 await expect(page.locator('.radio-name')).toBeVisible({timeout:5000});
 const start=(await state()).nativeCar;
 // The stick hard right, not forward at all, and Gas held.
 const zone=(await page.locator('.touch-stick-zone').boundingBox())!,x=zone.x+zone.width/2,y=zone.y+zone.height/2;
 await finger('.touch-stick-zone','pointerdown',x,y,7);await finger('.touch-stick-zone','pointermove',x+80,y,7);
 await press('.touch-button.gas:not([hidden])',11);await gameWait(1.2);
 const early=(await state()).nativeCar;await gameWait(1.3);const turning=(await state()).nativeCar;
 // It drives off and its course swings round: the direction of travel turns between the two looks.
 const moved=Math.hypot(turning.position.x-start.position.x,turning.position.z-start.position.z);
 const course=(v:{x:number;z:number})=>Math.atan2(v.x,v.z),turned=Math.abs(Math.atan2(Math.sin(course(turning.velocity)-course(early.velocity)),Math.cos(course(turning.velocity)-course(early.velocity))));
 expect(moved,JSON.stringify({start,early,turning})).toBeGreaterThan(3);expect(turned,JSON.stringify({early:early.velocity,turning:turning.velocity})).toBeGreaterThan(.3);
 // Let go of Gas and hold Brake: the car comes to a stop.
 await press('.touch-button.gas:not([hidden])',11,'pointerup');await finger('.touch-stick-zone','pointerup',x+80,y,7);
 await press('.touch-button.reverse:not([hidden])',12);
 await expect.poll(async()=>{const v=(await state()).nativeCar.velocity;return Math.hypot(v.x,v.z);},{timeout:15000}).toBeLessThan(1);
 await press('.touch-button.reverse:not([hidden])',12,'pointerup');
 expect(errors).toEqual([]);
});

/** The port's accelerometer steering: with Tilt chosen, the device turned like a wheel steers while Gas drives, no thumb
 * on the stick. (The test page's screen is landscape by nature, angle 0: its x axis to the right, y up the screen.) */
test('a phone steers by tilting with the Tilt setting',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('grove-touch-v1',JSON.stringify({steering:'tilt'})));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const clock=()=>page.evaluate(()=>(window as any).__game.gameTimeMs()/1000);
 const gameWait=async(s:number)=>{const t0=await clock();await expect.poll(clock,{timeout:60000}).toBeGreaterThan(t0+s);};
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));await gameWait(.5);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2491,g.groundAt(2491,1684,300)+.05,1684);g.turnPlayer(0);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);await gameWait(.5);
 const finger=(selector:string,type:string,id:number)=>page.evaluate(({selector,type,id})=>{const b=document.querySelector(selector)!.getBoundingClientRect();
  document.querySelector(selector)!.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:b.x+b.width/2,clientY:b.y+b.height/2,bubbles:true,cancelable:true}));},{selector,type,id});
 await finger('.touch-button.enter:not([hidden])','pointerdown',3);await finger('.touch-button.enter:not([hidden])','pointerup',3);
 await expect.poll(async()=>(await state()).carEntry.phase,{timeout:60000}).toBe('seated');
 // Leaning back 45 degrees and turned 30 clockwise: full lock to the right.
 const tilt=(wheel:number)=>page.evaluate(wheel=>{const w=wheel*Math.PI/180,a=Math.SQRT1_2,c=Math.SQRT1_2;
  window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:Math.asin(a*Math.cos(w))*180/Math.PI,gamma:Math.atan2(a*Math.sin(w),c)*180/Math.PI}));},wheel);
 await tilt(30);await finger('.touch-button.gas:not([hidden])','pointerdown',11);await gameWait(1.2);
 const early=(await state()).nativeCar;await tilt(30);await gameWait(1.3);const turning=(await state()).nativeCar;
 const course=(v:{x:number;z:number})=>Math.atan2(v.x,v.z),turned=Math.atan2(Math.sin(course(turning.velocity)-course(early.velocity)),Math.cos(course(turning.velocity)-course(early.velocity)));
 expect(Math.abs(turned),JSON.stringify({early:early.velocity,turning:turning.velocity})).toBeGreaterThan(.3);
 // Held level, it runs straight on.
 await tilt(0);await gameWait(.8);const a=(await state()).nativeCar;await gameWait(.8);const b=(await state()).nativeCar;
 const straight=Math.atan2(Math.sin(course(b.velocity)-course(a.velocity)),Math.cos(course(b.velocity)-course(a.velocity)));
 expect(Math.abs(straight)).toBeLessThan(Math.abs(turned)/2);
 await finger('.touch-button.gas:not([hidden])','pointerup',11);
 expect(errors).toEqual([]);
});

/** The port's default steering: with Arrow buttons chosen, two arrows under the left thumb take the stick's place at the
 * wheel, and holding the right one with Gas turns the car. */
test('a phone steers with the arrow buttons with the Arrows setting',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('grove-touch-v1',JSON.stringify({steering:'arrows'})));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const clock=()=>page.evaluate(()=>(window as any).__game.gameTimeMs()/1000);
 const gameWait=async(s:number)=>{const t0=await clock();await expect.poll(clock,{timeout:60000}).toBeGreaterThan(t0+s);};
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));await gameWait(.5);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2491,g.groundAt(2491,1684,300)+.05,1684);g.turnPlayer(0);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);await gameWait(.5);
 const finger=(selector:string,type:string,id:number)=>page.evaluate(({selector,type,id})=>{const b=document.querySelector(selector)!.getBoundingClientRect();
  document.querySelector(selector)!.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:b.x+b.width/2,clientY:b.y+b.height/2,bubbles:true,cancelable:true}));},{selector,type,id});
 // On foot the stick is there and the arrows are not.
 await expect(page.locator('.touch-stick-zone')).toBeVisible();await expect(page.getByRole('button',{name:'Steer right',exact:true})).toBeHidden();
 await finger('.touch-button.enter:not([hidden])','pointerdown',3);await finger('.touch-button.enter:not([hidden])','pointerup',3);
 await expect.poll(async()=>(await state()).carEntry.phase,{timeout:60000}).toBe('seated');
 await expect(page.getByRole('button',{name:'Steer right',exact:true})).toBeVisible();await expect(page.locator('.touch-stick-zone')).toBeHidden();
 await finger('.touch-button.steer-right','pointerdown',5);await finger('.touch-button.gas:not([hidden])','pointerdown',11);await gameWait(1.2);
 const early=(await state()).nativeCar;await gameWait(1.3);const turning=(await state()).nativeCar;
 const course=(v:{x:number;z:number})=>Math.atan2(v.x,v.z),turned=Math.atan2(Math.sin(course(turning.velocity)-course(early.velocity)),Math.cos(course(turning.velocity)-course(early.velocity)));
 expect(Math.abs(turned),JSON.stringify({early:early.velocity,turning:turning.velocity})).toBeGreaterThan(.3);
 await finger('.touch-button.gas:not([hidden])','pointerup',11);await finger('.touch-button.steer-right','pointerup',5);
 expect(errors).toEqual([]);
});
