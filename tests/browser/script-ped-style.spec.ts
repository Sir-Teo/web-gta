import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SET_ANIM_GROUP_FOR_CHAR gives a script ped another walkcycle (its moves and their speeds), and
 * SET_NEXT_DESIRED_MOVE_STATE's walk is how the next enter-car task goes to the door. */
test('a script ped walks with the gang walkcycle and walks, not runs, to a car when told',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const game=(window as any).__game,m=game.missionForProfiling(),p=game.state().player.position;
  const ped=m.peds.create(4,'MALE01',{x:p.x+4,y:-p.z,z:p.y}),car=m.vehicles.create(400,{x:p.x+14,y:-p.z,z:p.y},90);
  const plain=m.peds.create(4,'MALE01',{x:p.x-4,y:-p.z,z:p.y});
  // Said before the ped is built, as the scripts do on the line after CREATE_CHAR.
  m.runtime.world.setPedAnimGroup(ped,'GANG1');
  return {ped,car,plain};
 });
 await page.waitForFunction(({ped,car,plain}:{ped:number;car:number;plain:number})=>{const m=(window as any).__game.missionForProfiling();return !!(m.peds.entity(ped)&&m.vehicles.entity(car)&&m.peds.entity(plain));},made,{timeout:45000});
 const speeds=await page.evaluate(({ped,plain})=>{const m=(window as any).__game.missionForProfiling(),e=m.peds.entity(ped),q=m.peds.entity(plain);return {walk:e.walkSpeed,run:e.runSpeed,plainWalk:q.walkSpeed,plainRun:q.runSpeed};},made);
 // walk_gang1 and run_gang1 carry their own root speeds, not MALE01's own walkcycle's.
 expect(speeds.walk).toBeGreaterThan(.5);expect(Math.abs(speeds.walk-speeds.plainWalk)+Math.abs(speeds.run-speeds.plainRun)).toBeGreaterThan(.01);
 // SET_NEXT_DESIRED_MOVE_STATE 4 (walk), then TASK_ENTER_CAR_AS_PASSENGER: the ped walks the ten units.
 await page.evaluate(({ped,car})=>{
  const m=(window as any).__game.missionForProfiling();m.runtime.game.nextDesiredMoveState=4;
  m.runtime.world.givePedScriptedTask(ped,{kind:'enterCarAsPassenger',vehicle:car,time:-1,seat:0,moveState:m.runtime.game.nextDesiredMoveState},0x05ca);
 },made);
 const order=await page.evaluate(({ped})=>{const e=(window as any).__game.missionForProfiling().peds.entity(ped);return {kind:e.order?.kind,moveState:e.order?.moveState};},made);
 expect(order).toEqual({kind:'enterCar',moveState:4});
 await page.waitForTimeout(1500);
 const walking=await page.evaluate(({ped})=>{const e=(window as any).__game.missionForProfiling().peds.entity(ped);return e?{speed:e.actor.player.speed,walk:e.walkSpeed,run:e.runSpeed}:null;},made);
 if(walking)expect(walking.speed).toBeLessThan((walking.walk+walking.run)/2);
 expect(errors).toEqual([]);
});
