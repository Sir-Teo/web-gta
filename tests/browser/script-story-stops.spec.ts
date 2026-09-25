import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** What INTRO1, INTRO2 and SWEET1 reach first: GET_CLOSEST_CAR_NODE (FindNodeClosestToCoors over the car nodes),
 * TASK_WARP_CHAR_INTO_CAR_AS_DRIVER, EXPLODE_CAR_IN_CUTSCENE and IS_CAR_WAITING_FOR_WORLD_COLLISION. */
test('the closest car node, the warp task and the cutscene blow-up',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // The path areas load around the player; the node the question gives is a road near him, and the heading form
 // agrees with it.
 const node=await page.evaluate(async()=>{
  const g=(window as any).__game,w=g.missionForProfiling().runtime.world,p=g.state().player.position,at={x:p.x,y:-p.z,z:p.y};
  for(let i=0;i<50;i++){const n=w.closestVehicleNode(at.x,at.y,at.z);if(n.x||n.y)return {n,h:w.closestVehicleNodeWithHeading(at.x,at.y,at.z),at};await new Promise(r=>setTimeout(r,500));}
  return null;
 });
 expect(node).not.toBeNull();
 expect(Math.hypot(node!.n.x-node!.at.x,node!.n.y-node!.at.y)).toBeLessThan(80);
 expect([node!.h.x,node!.h.y]).toEqual([node!.n.x,node!.n.y]);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(596,{x:p.x+6,y:-p.z+7,z:-100},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 const seated=await page.evaluate(c=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.taskWarpCharIntoCarAsDriver(1,c);return {vehicle:w.pedVehicle(1),waiting:w.vehicleIsWaitingForWorldCollision(c)};},car);
 expect(seated).toEqual({vehicle:car,waiting:false});
 await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)??null),{timeout:20000}).toBeNull();
 await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.world.explodeVehicleInCutscene(c),car);
 expect(await page.evaluate(c=>(window as any).__game.missionForProfiling().vehicles.entity(c).wrecked,car)).toBe(true);
 expect(errors).toEqual([]);
});
