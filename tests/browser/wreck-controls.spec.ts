import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CAutomobile::ProcessAI's STATUS_WRECKED branch: a 0.05 brake with the handbrake on, no gas and the steering
 * straight, and BlowUpCar turns the engine off. A wreck keeps its front wheels barely
 * braked, and a wreck at rest or pushed backwards is not driven in reverse by the pedal logic. */
test('a wrecked car takes the wreck controls with its engine off',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await page.waitForFunction(()=>!!(window as any).__game.fleet()?.carById('starter'),undefined,{timeout:60000});
 await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;g.placePlayer(p.x+40,g.groundAt(p.x+40,p.z,p.y+20)+.05,p.z);});
 await page.waitForTimeout(1000);
 const start=await page.evaluate(()=>{const car=(window as any).__game.fleet().carById('starter'),b=car.car.body,q=b.rotation();
  const fx=2*(q.x*q.z+q.w*q.y),fz=1-2*(q.x*q.x+q.y*q.y),t=b.translation();b.setLinvel({x:fx*8,y:0,z:fz*8},true);car.blowUp();return {x:t.x,z:t.z};});
 await expect.poll(()=>page.evaluate(()=>{const v=(window as any).__game.fleet().carById('starter').car.body.linvel();return Math.hypot(v.x,v.z);}),{timeout:30000}).toBeLessThan(.2);
 const r=await page.evaluate(s=>{const car=(window as any).__game.fleet().carById('starter'),t=car.car.body.translation();return {moved:Math.hypot(t.x-s.x,t.z-s.z),engineOn:car.input.pedals.engineOn,ai:car.input.ai};},start);
 expect(r.engineOn).toBe(false);
 expect(r.ai).toMatchObject({gas:0,brake:.05,handbrake:true,steerAngle:0});
 expect(errors).toEqual([]);
});
