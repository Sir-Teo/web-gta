import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The next scripted ped tasks of the early story: TASK_GOTO_CHAR_OFFSET (SWEET1), TASK_LOOK_ABOUT and
 * TASK_DIE_NAMED_ANIM (SWEET1B), TASK_LOOK_AT_OBJECT (SWEET2), TASK_FLEE_POINT and TASK_SHUFFLE_TO_NEXT_CAR_SEAT
 * (SWEET4). */
test('a script ped seeks an offset, looks about, looks at an object, flees, dies with a clip and shuffles seats',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+6,y:-p.z,z:p.y});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 const give=(task:object)=>page.evaluate(({h,task})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(h,task,0x0600),{h:ped,task});
 const at=()=>page.evaluate(h=>{const e=(window as any).__game.missionForProfiling().peds.entity(h),q=e.actor.player.position,p=(window as any).__game.state().player;return {x:q.x,z:q.z,px:p.position.x,pz:p.position.z,heading:p.heading,order:e.order?.kind??null,health:e.health,look:!!e.look};},ped);
 // Two units out at 90 degrees from his heading: native (-sin a, cos a) x 2 with a his heading plus 90, which in the
 // renderer's x and z is (cos yaw, -sin yaw) x 2 for his yaw.
 await give({kind:'gotoPedOffset',target:1,time:-1,offsetX:2,offsetY:90});
 await expect.poll(async()=>(await at()).order,{timeout:60000}).not.toBe('gotoPed');
 const seek=await at(),yaw=seek.heading,left={x:seek.px+Math.cos(yaw)*2,z:seek.pz-Math.sin(yaw)*2};
 expect(Math.hypot(seek.x-left.x,seek.z-left.z)).toBeLessThan(1.5);
 await give({kind:'lookAbout',time:2000});
 expect((await at()).order).toBe('playAnim');
 const box=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().runtime.game.objects.create('cardboardbox',{x:p.x+3,y:-p.z+3,z:p.y},{external:false,missionCleanup:false}).handle;});
 await give({kind:'lookAtObject',object:box,time:3000});
 expect((await at()).look).toBe(true);
 const before=await at();
 await give({kind:'fleePoint',x:before.x,y:-before.z,z:-100,radius:20,time:8000});
 await expect.poll(async()=>{const a=await at();return Math.hypot(a.x-before.x,a.z-before.z);},{timeout:60000}).toBeGreaterThan(5);
 await give({kind:'dieNamedAnim',animationName:'KO_shot_front',animationFile:'ped',blendSpeed:4,time:-1});
 await expect.poll(async()=>(await at()).health,{timeout:20000}).toBe(0);
 // A passenger in the front right shuffles to the empty driver's seat.
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(596,{x:p.x-6,y:-p.z+7,z:-100},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 const rider=await page.evaluate(c=>(window as any).__game.missionForProfiling().peds.createInCar(7,'MALE01',c,0),car);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),rider,{timeout:60000});
 await page.evaluate(({h,c})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(h,{kind:'shuffleToNextCarSeat',vehicle:c},0x0676),{h:rider,c:car});
 expect(await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.world.vehicleDriver(c),car)).toBe(rider);
 expect(errors).toEqual([]);
});
