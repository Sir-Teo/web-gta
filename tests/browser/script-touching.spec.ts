import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** IS_CHAR_TOUCHING_OBJECT / _VEHICLE / _CHAR, IS_VEHICLE_TOUCHING_OBJECT (RYDER2, DRUGS3/4, TRUTH1) and
 * SET_OBJECT_RECORDS_COLLISIONS with HAS_OBJECT_COLLIDED_WITH_ANYTHING (RYDER2/3): CPhysical::GetHasCollidedWith, the
 * entity's collision touching the other's (a ped by the car it sits in). */
test('a script asks what the player, a ped, a car and an object are touching',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position,x=p.x,y=-p.z,ground=p.y;
  const objects=m.runtime.game.objects;
  // A cabin against the player, one far off, a car with a cabin against it, and a ped beside the player.
  const near=objects.create('portakabin',{x:x+1.6,y,z:ground+1.5},{external:false,missionCleanup:false}).handle;
  const far=objects.create('portakabin',{x:x+40,y,z:ground+1.5},{external:false,missionCleanup:false}).handle;
  const car=m.vehicles.create(596,{x:x-12,y,z:ground+.2},0);
  const byCar=objects.create('portakabin',{x:x-12+2.4,y,z:ground+1.5},{external:false,missionCleanup:false}).handle;
  return {near,far,car,byCar};
 });
 await page.waitForFunction(m=>{const g=(window as any).__game,v=g.scriptObjectViews(),mm=g.missionForProfiling();return [m.near,m.far,m.byCar].every(h=>!!v?.bodyOf(h))&&!!mm.vehicles.entity(m.car);},made,{timeout:90000});
 await page.waitForTimeout(1500);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 expect(await w('pedIsTouching',1,{kind:'object',handle:made.near})).toBe(true);
 expect(await w('pedIsTouching',1,{kind:'object',handle:made.far})).toBe(false);
 expect(await w('vehicleIsTouchingObject',made.car,made.byCar)).toBe(true);
 expect(await w('vehicleIsTouchingObject',made.car,made.near)).toBe(false);
 expect(await w('pedIsTouching',1,{kind:'vehicle',handle:made.car})).toBe(false);
 // A ped made against the player (their capsules 0.62 apart, centre to centre) touches him; one 3 units off does not.
 const peds=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return [m.peds.create(4,'MALE01',{x:p.x,y:-p.z-.62,z:p.y}),m.peds.create(4,'MALE01',{x:p.x,y:-p.z+3,z:p.y})];});
 await page.waitForFunction(hs=>hs.every((h:number)=>!!(window as any).__game.missionForProfiling().peds.entity(h)),peds,{timeout:60000});
 await w('freezePedPosition',peds[0],true);
 expect(await w('pedIsTouching',peds[0],{kind:'ped',handle:1})).toBe(true);
 expect(await w('pedIsTouching',1,{kind:'ped',handle:peds[1]})).toBe(false);
 // An object keeps no record until the script asks it to.
 expect(await w('objectHasCollidedWithAnything',made.far)).toBe(false);
 await w('setObjectRecordsCollisions',made.far,true);
 await expect.poll(()=>w('objectHasCollidedWithAnything',made.far),{timeout:20000}).toBe(true);
 expect(errors).toEqual([]);
});
