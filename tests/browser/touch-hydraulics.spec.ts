import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A lowrider's hydraulics on a touch screen: the port's Hydraulics button shows at the wheel of a car fitted with them
 * (the radio moving to the horn's place, the horn giving way); a tap raises the car as the horn does, and a drag from
 * the button is the car-gun stick, lifting the corners it is pushed toward. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('a phone works a lowrider\'s hydraulics: a tap raises it, a drag tips it',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // A Blade beside CJ, fitted with hydraulics.
 const low=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;return m.vehicles.create(536,{x:p.x+3,y:-p.z,z:-100},0) as number;});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)?.car.body.isEnabled(),low,{timeout:60000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 await w('setVehicleHydraulics',low,true);await page.waitForTimeout(1000);
 const press=async(selector:string,type:string,id:number,dx=0,dy=0)=>page.evaluate(({selector,type,id,dx,dy})=>{const b=document.querySelector(selector)!,r=b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:r.x+r.width/2+dx,clientY:r.y+r.height/2+dy,bubbles:true,cancelable:true}));},{selector,type,id,dx,dy});
 // CJ at its wheel (WARP_CHAR_INTO_CAR on the player).
 await w('warpPedIntoCar',1,low);
 await expect(page.locator('.touch-controls')).toHaveAttribute('data-mode','vehicle',{timeout:20000});
 const choice=page.locator('.touch-steering-choice [data-steering=stick]');
 if(await choice.isVisible()){await choice.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:9});await choice.dispatchEvent('pointerup',{pointerType:'touch',pointerId:9});}
 // At the wheel: Hydraulics at the radio's place, the radio at the horn's, no horn.
 const hydraulics=page.getByRole('button',{name:'Hydraulics',exact:true}),radio=page.locator('.touch-button.radio');
 await expect(hydraulics).toBeVisible();await expect(page.getByRole('button',{name:'Horn',exact:true})).toBeHidden();
 const centre=async(l:typeof radio)=>{const b=(await l.boundingBox())!;return [Math.round(b.x+b.width/2),Math.round(b.y+b.height/2)];};
 if(await radio.isVisible()){const [hx,hy]=await centre(hydraulics),[rx,ry]=await centre(radio);expect(Math.hypot(hx-rx,hy-ry)).toBeGreaterThan(20);}
 const angle=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).hydraulics.angle as number,low);
 const roll=()=>w('vehicleRoll',low) as Promise<number>;
 // A drag to the left lifts the left corners: the car rolls; let go, it settles.
 const flat=await roll();
 await press('.touch-button.hydraulics','pointerdown',21);
 for(let i=1;i<=8;i++){await press('.touch-button.hydraulics','pointermove',21,-i*8,0);await page.waitForTimeout(40);}
 await expect.poll(async()=>Math.abs((await roll())-flat),{timeout:10000}).toBeGreaterThan(2);
 expect(await page.evaluate(()=>(window as any).__game.state().paused)).toBe(false);
 await press('.touch-button.hydraulics','pointerup',21,-64,0);
 await expect.poll(async()=>Math.abs((await roll())-flat),{timeout:10000}).toBeLessThan(2);
 // A tap raises the whole car (HydraulicControl's horn branch: the angle goes to 500 and up).
 await press('.touch-button.hydraulics','pointerdown',22);await press('.touch-button.hydraulics','pointerup',22);
 await expect.poll(angle,{timeout:5000}).toBeGreaterThanOrEqual(500);
 // Out of the car the button goes, and the horn has its place back at the next car without hydraulics.
 await w('removeVehicleHydraulics',low).catch(()=>{});
 expect(errors).toEqual([]);
});
