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
 // The first time at the wheel the port asks how to steer, once: the stick is chosen here, and kept.
 const choice=page.getByRole('dialog',{name:'Choose steering',exact:true});await expect(choice).toBeVisible();
 for(const type of ['pointerdown','pointerup'])await page.evaluate(type=>{const b=document.querySelector('.touch-steering-choice [data-steering=stick]')!,r=b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent(type,{pointerId:9,pointerType:'touch',clientX:r.x+5,clientY:r.y+5,bubbles:true,cancelable:true}));},type);
 await expect(choice).toBeHidden();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('grove-touch-v1')!))).toMatchObject({steering:'stick',steeringChosen:true});
 // The Greenwood has no side mission: no Mission button.
 await expect(page.locator('.touch-context button[data-code=Digit2]')).toBeHidden();
 // Nitrous shows only in a car fitted with nitro, as the port's NOS button does.
 const nitro=page.getByRole('button',{name:'Nitrous',exact:true});await expect(nitro).toBeHidden();
 await page.evaluate(()=>{const car=[...(window as any).__game.fleet().cars].find((c:any)=>c.occupied);car.car.fitEndlessNitro();});
 await expect(nitro).toBeVisible();
 // Radio tunes the next station, named at the top of the screen.
 await press('.touch-button.radio',13);await press('.touch-button.radio',13,'pointerup');
 await expect(page.locator('.radio-name')).toBeVisible({timeout:5000});
 // Swiped to the left it tunes back (the port's radio swipe, the PC's Shift+N): a tap on and a swipe back is where it was.
 {const station=()=>page.locator('.radio-name').textContent(),first=await station();
  await press('.touch-button.radio',14);await press('.touch-button.radio',14,'pointerup');
  await expect.poll(station,{timeout:5000}).not.toBe(first);
  const b=(await page.locator('.touch-button.radio').boundingBox())!,x=b.x+b.width/2,y=b.y+b.height/2;
  await finger('.touch-button.radio','pointerdown',x,y,15);await finger('.touch-button.radio','pointermove',x-25,y+2,15);await finger('.touch-button.radio','pointerup',x-45,y+3,15);
  await expect.poll(station,{timeout:5000}).toBe(first);}
 // With a help line up (moved right of the radar on a phone, where the name stands top centre) the name drops under
 // the top strip, clear of it.
 await page.evaluate(async()=>{const gxt='/src/assets/gxt.ts',{gxtHudText}=await import(gxt);(window as any).__game.hud().help(gxtHudText('Press ~k~~VEHICLE_HORN~ to sound the horn and ~k~~VEHICLE_RADIO_STATION_UP~ to change the station.'),60000);});
 expect(await page.evaluate(()=>{const a=document.querySelector('.help-box')!.getBoundingClientRect(),b=document.querySelector('.radio-name')!.getBoundingClientRect();
  return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;})).toBe(false);
 await page.evaluate(()=>(window as any).__game.hud().help(''));
 const start=(await state()).nativeCar;
 // The car body's yaw, read from the car itself, so a bump into something later in the circle cannot hide the turn.
 const yaw=()=>page.evaluate(()=>{const q=[...(window as any).__game.fleet().cars].find((c:any)=>c.occupied).car.body.rotation();return Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y));});
 const before=await yaw();
 // The stick part of the way right first, as a thumb pushes it: a fraction of the pad's steering, which the native
 // input takes only in its whole units (the frame loop threw on it every step, the game frozen at the wheel of a car
 // steered by the stick or by tilt). Then hard right, not forward at all, with Gas held.
 const zone=(await page.locator('.touch-stick-zone').boundingBox())!,x=zone.x+zone.width/2,y=zone.y+zone.height/2;
 const travel=Number(await page.locator('.touch-stick-zone').getAttribute('data-travel'));
 await finger('.touch-stick-zone','pointerdown',x,y,7);await finger('.touch-stick-zone','pointermove',x+travel*.37,y+1,7);await gameWait(.5);
 expect(errors).toEqual([]);
 await finger('.touch-stick-zone','pointermove',x+travel+10,y,7);
 await press('.touch-button.gas:not([hidden])',11);await gameWait(1.5);
 const after=await yaw(),turning=(await state()).nativeCar;
 // It drives off and swings round.
 const moved=Math.hypot(turning.position.x-start.position.x,turning.position.z-start.position.z),turned=Math.abs(Math.atan2(Math.sin(after-before),Math.cos(after-before)));
 expect(moved,JSON.stringify({start,turning})).toBeGreaterThan(3);expect(turned,JSON.stringify({before,after,velocity:turning.velocity})).toBeGreaterThan(.3);
 await gameWait(1);
 // Let go of Gas and hold Brake: the car comes to a stop (held on, it then reverses, so the stop is looked for often).
 await press('.touch-button.gas:not([hidden])',11,'pointerup');await finger('.touch-stick-zone','pointerup',x+travel+10,y,7);
 await press('.touch-button.reverse:not([hidden])',12);
 await expect.poll(async()=>{const v=(await state()).nativeCar.velocity;return Math.hypot(v.x,v.z);},{timeout:15000,intervals:[100]}).toBeLessThan(1);
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
 // The car body's yaw before the arrow and Gas go down and a second and a half on: the turn is read from the car
 // itself, so a bump into something later in the circle cannot hide it.
 const yaw=()=>page.evaluate(()=>{const q=[...(window as any).__game.fleet().cars].find((c:any)=>c.occupied).car.body.rotation();return Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y));});
 const before=await yaw();
 await finger('.touch-button.steer-right','pointerdown',5);await finger('.touch-button.gas:not([hidden])','pointerdown',11);await gameWait(1.5);
 const after=await yaw(),turned=Math.atan2(Math.sin(after-before),Math.cos(after-before));
 expect(Math.abs(turned),JSON.stringify({before,after,velocity:(await state()).nativeCar.velocity})).toBeGreaterThan(.3);
 await finger('.touch-button.gas:not([hidden])','pointerup',11);await finger('.touch-button.steer-right','pointerup',5);
 expect(errors).toEqual([]);
});

/** A side-mission vehicle (a taxi here) puts up Mission, the port's mission start and cancel, which presses the
 * submission button (the PC's 2: the driving pad's right stick click). */
test('a phone gets the Mission button in a taxi',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('grove-touch-v1',JSON.stringify({steering:'stick'})));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 // On open ground, so the taxi set down beside CJ has its door clear (by Grove Street's fences and crates it may not).
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2495,g.groundAt(2495,1687,300)+.05,1687);g.turnPlayer(Math.PI);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.spawnVehicle(420));
 const taxi=()=>page.evaluate(()=>{const c=[...(window as any).__game.fleet().cars].find((c:any)=>c.modelId===420);return c?{occupied:c.occupied}:null;});
 await expect.poll(taxi,{timeout:60000}).not.toBeNull();
 const finger=(selector:string,type:string,id:number)=>page.evaluate(({selector,type,id})=>{const b=document.querySelector(selector)!.getBoundingClientRect();
  document.querySelector(selector)!.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:b.x+b.width/2,clientY:b.y+b.height/2,bubbles:true,cancelable:true}));},{selector,type,id});
 await expect(page.locator('.touch-button.enter')).toBeVisible({timeout:10000});
 await finger('.touch-button.enter:not([hidden])','pointerdown',3);await finger('.touch-button.enter:not([hidden])','pointerup',3);
 await expect.poll(async()=>(await taxi())?.occupied,{timeout:60000}).toBe(true);
 const mission=page.locator('.touch-context button[data-code=Digit2]');await expect(mission).toBeVisible();
 // Held, it is the driving pad's submission button.
 await finger('.touch-context button[data-code=Digit2]','pointerdown',21);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.pads.pads[0].rightShock),{timeout:5000}).toBe(255);
 await finger('.touch-context button[data-code=Digit2]','pointerup',21);
 expect(errors).toEqual([]);
});

/** A bicycle has no radio (its RadioType is disabled): on the BMX Gas pedals and Radio does not come up. */
test('a phone rides a BMX with no Radio button',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('grove-touch-v1',JSON.stringify({steering:'stick',steeringChosen:true})));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2495,g.groundAt(2495,1687,300)+.05,1687);g.turnPlayer(Math.PI);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.evaluate(async()=>{const g=(window as any).__game,p=g.state().player.position;await g.fleet().spawnBike(481,p.x+1.5,p.z,0,p.y);});
 await expect(page.locator('.touch-button.enter:not([hidden])')).toBeVisible({timeout:10000});
 for(const type of ['pointerdown','pointerup'])await page.evaluate(type=>{const b=document.querySelector('.touch-button.enter:not([hidden])')!,r=b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent(type,{pointerId:3,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true,cancelable:true}));},type);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet().occupiedBike),{timeout:30000}).toBe(true);
 await expect(page.locator('.touch-controls')).toHaveAttribute('data-mode','vehicle');
 await expect(page.locator('.touch-button.gas:not([hidden])')).toBeVisible();
 await page.waitForTimeout(1000);await expect(page.locator('.touch-button.radio:not([hidden])')).toHaveCount(0);
 expect(errors).toEqual([]);
});
