import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The Leviathan's winch (HEIST5): ATTACH_WINCH_TO_HELI (iOS 0x1001f8a70) gives the helicopter a magnet rope, which
 * CHeli::ProcessControl's UpdateWinch (iOS 0x100481ca4) registers under it every frame; the magnet takes the car it is
 * let down onto, GRAB_ENTITY_ON_WINCH gives the car back first (HEIST5 compares that output with its van, iOS
 * 0x1001f8d48), and RELEASE_ENTITY_FROM_WINCH lets it go. All three were skipped. */
test('the Leviathan\'s magnet takes the car under it, lifts it and lets it go',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // The airport's runway, flat and open.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,1600,-2593,13.6));
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:90000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const heli=await page.evaluate(()=>(window as any).__game.missionForProfiling().vehicles.create(417,{x:1620,y:-2593,z:-100},0) as number);
 await page.waitForFunction((h:number)=>(window as any).__game.missionForProfiling().vehicles.positionOf(h)?.z>-50,heli,{timeout:60000});
 // Held still in the air over the runway.
 const at=await page.evaluate((h:number)=>{const g=(window as any).__game,p=g.missionForProfiling().vehicles.positionOf(h);return {x:p.x,y:p.y,z:g.groundAt(p.x,-p.y,100) as number};},heli);
 await w('setVehicleCoordinates',heli,at.x,at.y,at.z+14);
 await w('freezeVehiclePosition',heli,true);
 await w('attachWinchToHeli',heli,1);
 const rope=()=>page.evaluate((h:number)=>{const m=(window as any).__game.missionForProfiling(),r=m.ropes.winchRope(h);if(!r)return null;
  const hook=r.hook&&m.runtime.game.objects.exists(r.hook.handle)?m.runtime.game.objects.at(r.hook.handle):undefined;
  return {type:r.type,height:r.height,top:r.segments[0],hook:hook?{model:hook.model,position:hook.position}:null};},heli);
 await expect.poll(async()=>(await rope())?.hook?.model??null,{timeout:20000}).toBe('INDUS_MAGNET');
 const first=(await rope())!;
 // A vehicle's winch starts nearly wound up (0.9), and a winch winds no further than 0.84: the magnet just under the helicopter.
 expect(first.type).toBe(1);expect(first.height).toBeCloseTo(.84,5);
 expect(Math.abs(first.top.z-(at.z+14))).toBeLessThan(2);
 // The rope is laid out sideways when made (RegisterRope for a winch) and the magnet swings on it; steadied under the
 // helicopter for the test.
 await page.evaluate((h:number)=>{const m=(window as any).__game.missionForProfiling(),r=m.ropes.winchRope(h),t=r.segments[r.wound],o=m.runtime.game.objects.at(r.hook.handle);
  o.position={x:t.x,y:t.y,z:t.z-(31-r.wound)*r.spacing};o.velocity={x:0,y:0,z:0};},heli);
 await page.waitForTimeout(500);
 const car=await page.evaluate(({x,y})=>(window as any).__game.missionForProfiling().vehicles.create(400,{x,y,z:-100},0) as number,{x:first.top.x,y:first.top.y});
 await page.waitForFunction((c:number)=>(window as any).__game.missionForProfiling().vehicles.positionOf(c)?.z>-50,car,{timeout:60000});
 const grabbed=()=>w('grabEntityOnWinch',heli) as Promise<{vehicle:number;char:number;object:number}>;
 expect((await grabbed()).vehicle).toBe(-1);
 // Let out (the turret stick's job) onto the car: taken.
 await page.evaluate((h:number)=>{(window as any).__game.missionForProfiling().ropes.winchRope(h).height=.2;},heli);
 await expect.poll(async()=>(await grabbed()).vehicle,{timeout:20000}).toBe(car);
 const z=()=>page.evaluate((c:number)=>(window as any).__game.missionForProfiling().vehicles.positionOf(c).z as number,car);
 const resting=await z();
 // Wound back up, the car comes up under the helicopter.
 await page.evaluate((h:number)=>{(window as any).__game.missionForProfiling().ropes.winchRope(h).height=.84;},heli);
 await expect.poll(z,{timeout:20000}).toBeGreaterThan(resting+5);
 const lifted=await z();
 await w('releaseEntityFromWinch',heli);
 expect((await grabbed()).vehicle).toBe(-1);
 await expect.poll(z,{timeout:10000}).toBeLessThan(lifted-3);
 expect(errors).toEqual([]);
});
