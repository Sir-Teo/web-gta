import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A finger cannot hold a crosshair on a ped the way a mouse can: with the touch controls, Aim with a gun eases the
 * camera onto the ped nearest the crosshair, and the gun locks onto him. With the mouse the camera stays put. */
test.use({hasTouch:true});
for(const [touch,assist] of [[true,true],[true,false],[false,false]] as const)test(`aiming a pistol at a ped off the crosshair ${touch?assist?'locks on with the touch controls':'stays free with the touch free-aim setting':'stays free with the mouse'}`,async({page})=>{
 test.setTimeout(180000);
 if(touch&&!assist)await page.addInitScript(()=>localStorage.setItem('grove-touch-v1',JSON.stringify({aimAssist:false})));const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`/?touch=${touch?1:0}`);await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.state().pedestrians.people.some((p:any)=>!p.officer&&p.health>0),undefined,{timeout:60000});
 await page.evaluate(()=>(window as any).__game.weapons().inventory.select(22));await page.waitForTimeout(1000);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {yaw:s.camera.yaw as number,player:s.player.position,lock:s.weapons.lock};});
 // A ped nine metres out, a fifth of a radian to the side of where the camera looks: well off the crosshair.
 const s=await state(),view={x:-Math.sin(s.yaw),z:-Math.cos(s.yaw)},side=.2;
 const at={x:s.player.x+9*(view.x*Math.cos(side)-view.z*Math.sin(side)),z:s.player.z+9*(view.x*Math.sin(side)+view.z*Math.cos(side))};
 const id=await page.evaluate(([x,y,z])=>(window as any).__game.placePed(x,y,z),[at.x,s.player.y,at.z]);expect(id).not.toBeNull();
 await page.waitForTimeout(500);
 const handle=await page.evaluate(id=>(window as any).__game.state().pedestrians.people.find((p:any)=>p.id===id)?.handle,id);
 if(touch&&assist){
  await page.locator('.touch-button.aim').dispatchEvent('pointerdown',{pointerType:'touch'});
  await expect.poll(async()=>(await state()).lock,{timeout:5000}).toBe(handle);
  expect(Math.abs((await state()).yaw-s.yaw)).toBeGreaterThan(.05);
 }else if(touch){
  await page.locator('.touch-button.aim').dispatchEvent('pointerdown',{pointerType:'touch'});await page.waitForTimeout(1500);
  const after=await state();expect(after.lock).toBeNull();expect(Math.abs(after.yaw-s.yaw)).toBeLessThan(.01);
 }else{
  await page.mouse.move(400,300);await page.mouse.down({button:'right'});await page.waitForTimeout(1500);
  const after=await state();await page.mouse.up({button:'right'});
  expect(after.lock).toBeNull();expect(Math.abs(after.yaw-s.yaw)).toBeLessThan(.01);
 }
 expect(errors).toEqual([]);
});
/** The mobile ports' lock-on switches targets with a swipe: a finger dragging the camera from the ped held onto another
 * close beside him (within the angle that would otherwise keep the first) leaves the crosshair on the second. */
test('a swipe moves the touch aim assist onto the next ped',async({page,context})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.state().pedestrians.people.filter((p:any)=>!p.officer&&p.health>0).length>=2,undefined,{timeout:60000});
 await page.evaluate(()=>(window as any).__game.weapons().inventory.select(22));await page.waitForTimeout(1000);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {yaw:s.camera.yaw as number,player:s.player.position,lock:s.weapons.lock};});
 // Two peds nine metres out, a fifth of a radian either side of the view: the right one (yaw falling) first.
 const s=await state(),view={x:-Math.sin(s.yaw),z:-Math.cos(s.yaw)};
 const place=async(side:number)=>{const at={x:s.player.x+9*(view.x*Math.cos(side)-view.z*Math.sin(side)),z:s.player.z+9*(view.x*Math.sin(side)+view.z*Math.cos(side))};
  const id=await page.evaluate(({at,except})=>(window as any).__game.placePed(at.x,at.y,at.z,except),{at:{...at,y:s.player.y},except:placed});expect(id).not.toBeNull();placed.push(id);await page.waitForTimeout(300);
  return page.evaluate(id=>(window as any).__game.state().pedestrians.people.find((p:any)=>p.id===id)?.handle,id);};
 const placed:number[]=[],right=await place(.2),left=await place(-.2);expect(right).not.toBe(left);
 await page.locator('.touch-button.aim').dispatchEvent('pointerdown',{pointerType:'touch'});
 await expect.poll(async()=>(await state()).lock,{timeout:5000}).toBe(right);
 // A finger on the look area drags left, a few pixels at a time, until the view faces the other ped; then lifts.
 const cdp=await context.newCDPSession(page),size=page.viewportSize()!,from={x:size.width*.75,y:size.height*.3};let x=from.x;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:5}]});
 for(let i=0;i<60&&(await state()).yaw<s.yaw+.17;i++){x-=4;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:from.y,id:5}]});await page.waitForTimeout(30);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(async()=>(await state()).lock,{timeout:5000}).toBe(left);
 await page.waitForTimeout(800);const after=await state();expect(after.lock).toBe(left);expect(after.yaw).toBeGreaterThan(s.yaw);
 expect(errors).toEqual([]);
});
