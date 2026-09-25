import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_PICK_UP_OBJECT with no clip: CTaskSimpleHoldEntity puts the object in the ped's hand (PED_NODE_RIGHT_HAND,
 * the bone's own matrix with HOLD_ENTITY_UPDATE_TRANSLATION_ONLY) and takes its collision; IS_CHAR_HOLDING_OBJECT
 * says so; DROP_OBJECT sets it down under the ped with its collision back. */
test('the player holds a script object in his hand and drops it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const handle=await page.evaluate(()=>{
  const g=(window as any).__game,p=g.state().player.position,m=g.missionForProfiling();
  const object=m.runtime.game.objects.create('cardboardbox',{x:p.x+1,y:-p.z,z:p.y},{external:false,missionCleanup:false});
  m.runtime.world.givePedScriptedTask(1,{kind:'pickUpObject',object:object.handle,offset:{x:0,y:0,z:0},bone:6,orientation:16,animationName:'NULL',animationFile:'NULL',time:-1},0x0687);
  return object.handle;
 });
 const read=()=>page.evaluate(h=>{
  const g=(window as any).__game,m=g.missionForProfiling(),o=m.runtime.game.objects.at(h),p=g.state().player.position;
  return {held:m.runtime.world.pedIsHoldingObject(1,h),collision:o.usesCollision,d:Math.hypot(o.position.x-p.x,o.position.y+p.z),dz:o.position.z-p.y,hasMatrix:!!o.matrix};
 },handle);
 await expect.poll(async()=>(await read()).hasMatrix,{timeout:20000}).toBe(true);
 const held=await read();
 expect(held.held).toBe(true);expect(held.collision).toBe(false);
 // The right hand is beside him, about a metre above his feet (the dev state's position).
 expect(held.d).toBeLessThan(.8);expect(held.dz).toBeGreaterThan(.3);expect(held.dz).toBeLessThan(1.6);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedDropsObject(1,true));
 const dropped=await read();
 // Set down under him: its base on the ground his feet stand on.
 expect(dropped.held).toBe(false);expect(dropped.collision).toBe(true);expect(dropped.dz).toBeGreaterThan(-.1);expect(dropped.dz).toBeLessThan(.6);
 expect(errors).toEqual([]);
});
