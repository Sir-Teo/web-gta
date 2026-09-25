import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_DESTROY_CAR (SWEET4's gang, then WUZI5 and others): an armed ped closes into half its weapon's range and
 * shoots the car until it is wrecked, and the task ends; an unarmed ped walks up and punches it. */
test('a script ped shoots a car to a wreck, and an unarmed one punches another',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return {car:m.vehicles.create(596,{x:p.x+22,y:-p.z,z:-100},0),ped:m.peds.create(4,'MALE01',{x:p.x+6,y:-p.z,z:p.y})};
 });
 await page.waitForFunction(({car,ped})=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(car)&&!!m.peds.entity(ped);},made,{timeout:60000});
 await page.evaluate(({ped})=>{const world=(window as any).__game.missionForProfiling().runtime.world;world.givePedWeapon(ped,22,500);
  // Street peds answer gunfire; the ped is proofed so that the check stays on the task.
  world.setPedProofs(ped,{bullet:true,fire:true,explosion:true,collision:false,melee:true});},made);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h).weapon,made.ped,{timeout:60000});
 await page.evaluate(({ped,car})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(ped,{kind:'destroyCar',vehicle:car},0x0672),made);
 const state=()=>page.evaluate(({ped,car})=>{
  const m=(window as any).__game.missionForProfiling(),e=m.peds.entity(ped),c=m.vehicles.entity(car);
  const q=e.actor.player.position,t=c.car.body.translation();
  return {order:e.order?.kind??null,phase:e.order?.phase??null,distance:Math.hypot(t.x-q.x,t.z-q.z),health:c.health,wrecked:!!c.wrecked};
 },made);
 // A pistol's range is 35: the ped closes to under 1.1 x 17.5 of the car and shoots it.
 await expect.poll(async()=>(await state()).phase,{timeout:60000}).toBe('attack');
 expect((await state()).distance).toBeLessThan(35*.55+1);
 await expect.poll(async()=>(await state()).health,{timeout:60000}).toBeLessThan(1000);
 await expect.poll(async()=>(await state()).wrecked,{timeout:180000}).toBe(true);
 await expect.poll(async()=>(await state()).order,{timeout:10000}).not.toBe('destroyCar');
 // Unarmed, the ped walks to the car and punches it.
 const second=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return {car:m.vehicles.create(596,{x:p.x+12,y:-p.z+10,z:-100},0),ped:m.peds.create(4,'MALE01',{x:p.x+6,y:-p.z+3,z:p.y})};
 });
 await page.waitForFunction(({car,ped})=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(car)&&!!m.peds.entity(ped);},second,{timeout:60000});
 await page.evaluate(({ped,car})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(ped,{kind:'destroyCar',vehicle:car},0x0672),second);
 const punched=()=>page.evaluate(({ped,car})=>{const m=(window as any).__game.missionForProfiling(),e=m.peds.entity(ped),c=m.vehicles.entity(car);return {melee:e.order?.melee??null,health:c.health};},second);
 expect((await punched()).melee).toBe(true);
 await expect.poll(async()=>(await punched()).health,{timeout:60000}).toBeLessThan(1000);
 expect(errors).toEqual([]);
});
