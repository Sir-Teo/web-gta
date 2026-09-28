import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** ComputeResponseLeaderExitedCar gives the script's peds in the player's group CTaskComplexLeaveCar with
 * bSensibleLeaveCar off: when CJ bails out of a fast car they do not wait in their seats for it to slow, they roll out
 * (CTaskSimpleCarJumpOut's CAR_rollout clip) with its speed. */
test('a script follower rolls out of the car CJ bails out of at speed',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+2,y:-p.z+2,z:p.y});});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:45000});
 await w('setGroupMember',await w('getPlayerGroup'),ped);
 await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;const car=[...g.fleet().cars].sort((a:any,b:any)=>{const d=(c:any)=>{const t=c.car.body.translation();return Math.hypot(t.x-p.x,t.z-p.z);};return d(a)-d(b);})[0];g.carEntry().enter(car);});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().carEntry.phase),{timeout:60000}).toBe('seated');
 const car=await w('pedVehicle',1) as number;
 await expect.poll(()=>w('pedVehicle',ped),{timeout:90000}).toBe(car);
 // The cul-de-sac is too short to reach the jump-out speed: the car is given it.
 await page.evaluate(()=>{(window as any).__game.carEntry().car.car.body.setLinvel({x:0,y:0,z:-24},true);});
 await page.keyboard.press('KeyF');
 let clip:string|null=null;
 for(let i=0;i<80&&!clip;i++){clip=await page.evaluate((h:number)=>{const e=(window as any).__game.missionForProfiling().peds.entity(h);const r=e?.view?.reactionName;return r&&/car_rollout/.test(r)?r:null;},ped);await page.waitForTimeout(50);}
 expect(clip).toMatch(/car_rollout_(lhs|rhs)/);
 expect(errors).toEqual([]);
});
