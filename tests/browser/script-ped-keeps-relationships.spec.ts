import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CPed is one object in its car and out of it: a decision maker given on foot and a relationship set while seated
 * (TWAR7 sets OG Loc's hate for Freddy's ped type, MISSION1, with him on CJ's bike) are the ped's when it gets out. */
test('a script ped keeps its decision maker and relationships through a ride',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const at=await page.evaluate(()=>{const p=(window as any).__game.state().player.position;return {x:p.x,y:-p.z,z:p.y};});
 const made=await page.evaluate(at=>{const m=(window as any).__game.missionForProfiling();
  return {car:m.vehicles.create(400,{x:at.x+6,y:at.y,z:at.z},0),ped:m.peds.create(4,'MALE01',{x:at.x+3,y:at.y+3,z:at.z})};},at);
 await page.waitForFunction(m=>{const g=(window as any).__game.missionForProfiling();return !!g.vehicles.entity(m.car)&&!!g.peds.entity(m.ped);},made,{timeout:60000});
 const own=()=>page.evaluate(m=>{const e=(window as any).__game.missionForProfiling().peds.entity(m.ped);
  return e&&{rider:!!e.rider,decisionMaker:e.decisionMaker,hatesMission1:!!e.acquaintance&&(e.acquaintance.get(4)&(1<<24))!==0};},made);
 // A game decision maker (65536 + 5) on foot, then into the car, and the hate set on the rider.
 await w('setPedDecisionMaker',made.ped,65536+5);
 await w('warpPedIntoCarAsPassenger',made.ped,made.car,0);
 await expect.poll(async()=>(await own())?.rider,{timeout:30000}).toBe(true);
 expect((await own())!.decisionMaker).toBe(5);
 await w('setPedRelationship',made.ped,4,24);
 expect((await own())!.hatesMission1).toBe(true);
 // Out on foot again, he is the same ped.
 await w('warpPedFromCarToCoord',made.ped,at.x+3,at.y-3,at.z);
 await expect.poll(async()=>(await own())?.rider,{timeout:30000}).toBe(false);
 expect(await own()).toEqual({rider:false,decisionMaker:5,hatesMission1:true});
 expect(errors).toEqual([]);
});
