import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Flying with the touch controls: the stick is the yoke (pushed forward the nose goes down, as the ↑ key and a pad's
 * stick do; to the side it rolls) and the right thumb has Thrust, Slow, the rudder, Brake and the rockets. */
test.use({hasTouch:true});
test('a phone flies the Maverick: Thrust climbs, the stick pitches and rolls it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await page.locator('.touch-top .touch-button').nth(1).dispatchEvent('pointerdown',{pointerType:'touch'});
 await page.getByLabel('Aircraft',{exact:true}).selectOption('487');await page.getByRole('button',{name:'Fly from Verdant Meadows',exact:true}).click();
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).aircraft?.occupied,{timeout:60000}).toBe(true);
 const controls=page.locator('.touch-controls');await expect(controls).toBeVisible();await expect(controls).toHaveAttribute('data-mode','aircraft');
 await expect(page.locator('.touch-button.gas:not([hidden])')).toHaveText('Thrust');await expect(page.locator('.touch-button.yaw-left:not([hidden])')).toBeVisible();await expect(page.locator('.touch-button.aim')).toBeHidden();
 const finger=(selector:string,type:string,x:number,y:number,id:number)=>page.evaluate(({selector,type,x,y,id})=>{
  document.querySelector(selector)!.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
 },{selector,type,x,y,id});
 const press=async(selector:string,id:number,type='pointerdown')=>{const b=(await page.locator(selector).boundingBox())!;await finger(selector,type,b.x+b.width/2,b.y+b.height/2,id);};
 // Thrust lifts it off.
 const start=(await state()).aircraft.position.y;
 await press('.touch-button.gas:not([hidden])',11);await page.waitForTimeout(4000);await press('.touch-button.gas:not([hidden])',11,'pointerup');
 await expect.poll(async()=>(await state()).aircraft.position.y,{timeout:10000}).toBeGreaterThan(start+3);
 // The stick tilts it: to the side it banks, and forward it pitches the way the ↑ key (nose down) does.
 const zone=(await page.locator('.touch-stick-zone').boundingBox())!,x=zone.x+zone.width/2,y=zone.y+zone.height/2;
 const tilt=async(move:(page:Page)=>Promise<void>,release:(page:Page)=>Promise<void>)=>{
  const q0=(await state()).aircraft.rotation;await move(page);await page.waitForTimeout(600);const q1=(await state()).aircraft.rotation;await release(page);await page.waitForTimeout(1500);
  // The turn from q0 to q1 in the aircraft's own frame: conj(q0) × q1, its vector part (twice the half-angle sines).
  const c={w:q0.w,x:-q0.x,y:-q0.y,z:-q0.z};
  return {x:c.w*q1.x+c.x*q1.w+c.y*q1.z-c.z*q1.y,y:c.w*q1.y-c.x*q1.z+c.y*q1.w+c.z*q1.x,z:c.w*q1.z+c.x*q1.y-c.y*q1.x+c.z*q1.w};
 };
 const yoke=(dx:number,dy:number)=>async()=>{await finger('.touch-stick-zone','pointerdown',x,y,7);await finger('.touch-stick-zone','pointermove',x+dx,y+dy,7);};
 const letGo=async()=>{await finger('.touch-stick-zone','pointerup',x,y,7);};
 const bank=await tilt(yoke(80,0),letGo),forward=await tilt(yoke(0,-80),letGo);
 const key=await tilt(async p=>{await p.keyboard.down('ArrowUp');},async p=>{await p.keyboard.up('ArrowUp');});
 const largest=(v:{x:number;y:number;z:number})=>(['x','y','z'] as const).reduce((a,b)=>Math.abs(v[a])>=Math.abs(v[b])?a:b);
 expect(Math.hypot(bank.x,bank.y,bank.z),JSON.stringify(bank)).toBeGreaterThan(.02);
 const axis=largest(key);expect(Math.abs(key[axis]),JSON.stringify(key)).toBeGreaterThan(.02);
 expect(Math.sign(forward[axis]),JSON.stringify({forward,key})).toBe(Math.sign(key[axis]));
 expect(errors).toEqual([]);
});
