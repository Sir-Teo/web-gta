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
