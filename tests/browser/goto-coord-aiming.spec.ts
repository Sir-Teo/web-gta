import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// TASK_GO_TO_COORD_WHILE_AIMING as the iOS CTaskComplexGoToPointAiming runs it. The weapon at the start picks the walk:
// - a pistol (aimed with the arm) walks to the point aiming and the task ends there;
// - an M4 (shoulder-aimed, instant-hit) aim-walks with CTaskSimpleGunControl and goes on aiming once there;
// - an unarmed ped only walks.
test('the aiming walk takes its branch from the weapon',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 const made=await page.evaluate(()=>{const g=(window as any).__game,a=g.missionForProfiling().adapterRef,p=g.state().player.position,h=g.sim.player.heading;
  // Three peds side by side four units ahead of CJ.
  const at=(side:number)=>({x:p.x+Math.sin(h)*4+Math.cos(h)*side,y:-(p.z+Math.cos(h)*4-Math.sin(h)*side),z:p.y});
  const pistol=at(-2),rifle=at(0),bare=at(2);
  return {pistol:a.createChar(4,7,pistol.x,pistol.y,pistol.z),rifle:a.createChar(4,7,rifle.x,rifle.y,rifle.z),bare:a.createChar(4,7,bare.x,bare.y,bare.z),
   ahead:{x:Math.sin(h)*3,y:-Math.cos(h)*3}};});
 const order=(h:number)=>page.evaluate(h=>{const e=(window as any).__game.missionForProfiling().peds.entity(h);return e?{kind:e.order?.kind??null,branch:e.order?.aimBranch??null}:null;},h);
 await expect.poll(async()=>!!(await order(made.pistol))&&!!(await order(made.rifle))&&!!(await order(made.bare)),{timeout:60000}).toBe(true);
 const AIMING=0x6c2;
 await page.evaluate(m=>{const a=(window as any).__game.missionForProfiling().adapterRef;a.givePedWeapon(m.pistol,22,100);a.givePedWeapon(m.rifle,31,100);},made);
 // The browser loads a weapon's model and data before the ped holds it.
 await expect.poll(()=>page.evaluate(m=>{const peds=(window as any).__game.missionForProfiling().peds;return !!peds.entity(m.pistol).weapon&&!!peds.entity(m.rifle).weapon;},made),{timeout:30000}).toBe(true);
 await page.evaluate(({m,AIMING})=>{const g=(window as any).__game,a=g.missionForProfiling().adapterRef;
  for(const h of [m.pistol,m.rifle,m.bare]){
   const q=g.missionForProfiling().peds.positionOf(h);
   // Three units on, aimed at CJ; a slow-down distance of 2 keeps the script's radius of 1.
   a.givePedScriptedTask(h,{kind:'goToCoordWhileAiming',x:q.x+m.ahead.x,y:q.y+m.ahead.y,z:q.z,speed:4,targetRadius:1,slowDownDistance:2,aimPed:1,aimX:0,aimY:0,aimZ:0},AIMING);
  }},{m:made,AIMING});
 expect(await order(made.pistol)).toEqual({kind:'goToPointShooting',branch:'arm'});
 expect(await order(made.rifle)).toEqual({kind:'goToPointShooting',branch:'gunControl'});
 expect(await order(made.bare)).toEqual({kind:'goToPointShooting',branch:'walk'});
 const status=(h:number)=>page.evaluate(({h,AIMING})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(h,AIMING),{h,AIMING});
 // The pistol and the bare-handed walks end at the point.
 await expect.poll(()=>status(made.pistol),{timeout:30000}).toBe(7);
 await expect.poll(()=>status(made.bare),{timeout:30000}).toBe(7);
 // The rifle stands at the point still aiming: the task goes on.
 await page.waitForTimeout(3000);
 expect(await order(made.rifle)).toEqual({kind:'goToPointShooting',branch:'gunControl'});
 expect(await status(made.rifle)).not.toBe(7);
 expect(errors).toEqual([]);
});
