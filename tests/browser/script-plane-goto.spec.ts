import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** PLANE_GOTO_COORDS (iOS 0x1001e3a9c, CAutomobile::TellPlaneToGoToCoors 0x100440934) and the AI plane it sets flying
 * (FlyAIPlaneInCertainDirection, iOS 0x10019f1c4): ZERO1's and CPRACE's planes fly to their points. The command was
 * skipped, so a script plane flew nowhere (and fell). A plane over the sea heading north, sent to a point west of it,
 * banks round toward the point and holds its height. */
test('a script plane told to fly to a point turns toward it and keeps its height',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // Santa Maria Beach, the sea to the south.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,370,-1880,6));
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:90000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 // A Rustler made in the air over the sea, facing north at speed.
 const plane=await page.evaluate(()=>(window as any).__game.missionForProfiling().vehicles.create(476,{x:370,y:-2300,z:120},0) as number);
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),plane,{timeout:60000});
 await w('planeStartsInAir',plane);
 await w('setVehicleForwardSpeed',plane,40);
 const target={x:-300,y:-2300,z:120};
 await w('planeGotoCoords',plane,target.x,target.y,target.z,20,100);
 const at=()=>page.evaluate((h:number)=>{const m=(window as any).__game.missionForProfiling(),p=m.vehicles.positionOf(h);return {x:p.x as number,y:p.y as number,z:p.z as number};},plane);
 const start=await at();
 const gap=(p:{x:number;y:number})=>Math.hypot(p.x-target.x,p.y-target.y);
 // It comes round to the west: much nearer the point within 25 seconds, still flying well over the sea.
 await expect.poll(async()=>gap(await at()),{timeout:25000,intervals:[1000]}).toBeLessThan(gap(start)-250);
 const now=await at();
 expect(now.z).toBeGreaterThan(40);
 expect(errors).toEqual([]);
});

/** PLANE_FOLLOW_ENTITY (iOS 0x1001f6440): MISSION_PLANE_FOLLOW_ENTITY heads for the entity at its height (MANSIO2's jets
 * after the player's Hydra). The command was skipped. A plane over the sea heading east, told to follow the player on
 * the beach to its north, comes round to him. */
test('a script plane told to follow the player comes round toward him',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,370,-1880,6));
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:90000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 // Facing east (heading 270) over the sea, 500 south of the player.
 const plane=await page.evaluate(()=>(window as any).__game.missionForProfiling().vehicles.create(476,{x:370,y:-2380,z:120},270) as number);
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),plane,{timeout:60000});
 await w('planeStartsInAir',plane);await w('setVehicleForwardSpeed',plane,40);
 await w('planeFollowEntity',plane,1,-1,30);
 const gap=()=>page.evaluate((h:number)=>{const m=(window as any).__game.missionForProfiling(),p=m.vehicles.positionOf(h),me=m.runtime.world.pedPosition(1);return Math.hypot(p.x-me.x,p.y-me.y);},plane);
 const start=await gap();
 await expect.poll(gap,{timeout:25000,intervals:[1000]}).toBeLessThan(start-250);
 expect(errors).toEqual([]);
});
