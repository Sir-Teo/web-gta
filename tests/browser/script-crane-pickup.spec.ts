import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CRope::Update's pickup (iOS 0x10025e2c8 on) and the rope commands STEAL4 loads its ship with: the dock crane's magnet
 * takes a container it is let down onto (GRAB_ENTITY_ON_ROPE_FOR_OBJECT gives it back as the object), winding the rope
 * up lifts it, a car put in it with ATTACH_CAR_TO_OBJECT goes up with it, and RELEASE_ENTITY_FROM_ROPE_FOR_OBJECT lets it
 * drop. All four commands were skipped. */
test('the dock crane\'s magnet takes a container, lifts it with a car inside and lets it go',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,-1530,110,20));
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:90000});
 // The arm swung round over the quay (crane2.scm turns it the same way, SET_OBJECT_ROTATION with its 15-degree tilt).
 const arm=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),arm=[...m.runtime.game.objects.values()].find((o:any)=>o.model==='MAGNOCRANE_03');
  m.runtime.game.objects.setRotation(arm.handle,15,0,180);return arm.handle as number;});
 // The arm's turn sets the magnet swinging on its long rope; for the test it is wound up and steadied under the arm.
 await page.evaluate((arm:number)=>(window as any).__game.missionForProfiling().runtime.world.setRopeHeightForObject(arm,.8),arm);
 await page.waitForTimeout(500);
 await page.evaluate((arm:number)=>{const m=(window as any).__game.missionForProfiling(),r=m.ropes.find(arm),t=r.segments[r.wound],h=m.runtime.game.objects.at(r.hook.handle);
  h.position={x:t.x,y:t.y,z:t.z-(31-r.wound)*r.spacing};h.velocity={x:0,y:0,z:0};},arm);
 await page.waitForTimeout(1000);
 const container=await page.evaluate((arm:number)=>{
  // On the quay under the arm, where the magnet hangs.
  const g=(window as any).__game,m=g.missionForProfiling(),r=m.ropes.find(arm),p=r.segments[r.wound],ground=g.groundAt(p.x,-p.y,p.z-20);
  return m.runtime.game.objects.create('KMB_CONTAINER_RED',{x:p.x,y:p.y,z:ground+1.4},{external:false,missionCleanup:false}).handle as number;
 },arm);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const grabbed=()=>w('grabEntityOnRopeForObject',arm) as Promise<{vehicle:number;ped:number;object:number}>;
 expect(await grabbed()).toEqual({vehicle:-1,ped:-1,object:-1});
 // Let down onto it, the magnet takes it.
 await w('setRopeHeightForObject',arm,.2);
 await expect.poll(async()=>(await grabbed()).object,{timeout:20000}).toBe(container);
 const z=()=>page.evaluate((h:number)=>(window as any).__game.missionForProfiling().runtime.game.objects.at(h).position.z as number,container);
 const resting=await z();
 // A car in it (STEAL4's offset), then wound up: the container rises with the car.
 const car=await page.evaluate((h:number)=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.game.objects.at(h).position;return m.vehicles.create(400,{x:p.x+8,y:p.y,z:p.z+1},0);},container);
 await page.waitForFunction((c:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 await w('attachCarToObject',car,container,0,0,-.8,0,0,180);
 expect(await w('isVehicleAttached',car)).toBe(true);
 await w('setRopeHeightForObject',arm,.8);
 await expect.poll(z,{timeout:20000}).toBeGreaterThan(resting+5);
 const carZ=await page.evaluate((c:number)=>(window as any).__game.missionForProfiling().vehicles.positionOf(c).z,car);
 expect(Math.abs(carZ-(await z()-.8))).toBeLessThan(1.5);
 // Let go: nothing on the hook and the container falls.
 const lifted=await z();
 await w('releaseEntityFromRopeForObject',arm);
 expect(await grabbed()).toEqual({vehicle:-1,ped:-1,object:-1});
 await expect.poll(z,{timeout:10000}).toBeLessThan(lifted-3);
 expect(errors).toEqual([]);
});

/** The hook's vehicle scan (iOS 0x10025e47c on): the dock crane takes a car let down onto it unless
 * WINCH_CAN_PICK_VEHICLE_UP has cleared its bWinchCanPickMeUp (set for every vehicle as it is made), lifts it, and the
 * script reads it back as the vehicle. */
test('the dock crane\'s magnet takes a car the winch may take, and leaves one it may not',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,-1530,110,20));
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:90000});
 const arm=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),arm=[...m.runtime.game.objects.values()].find((o:any)=>o.model==='MAGNOCRANE_03');
  m.runtime.game.objects.setRotation(arm.handle,15,0,180);return arm.handle as number;});
 // The arm's turn sets the magnet swinging on its long rope; for the test it is wound up and steadied under the arm.
 await page.evaluate((arm:number)=>(window as any).__game.missionForProfiling().runtime.world.setRopeHeightForObject(arm,.8),arm);
 await page.waitForTimeout(500);
 await page.evaluate((arm:number)=>{const m=(window as any).__game.missionForProfiling(),r=m.ropes.find(arm),t=r.segments[r.wound],h=m.runtime.game.objects.at(r.hook.handle);
  h.position={x:t.x,y:t.y,z:t.z-(31-r.wound)*r.spacing};h.velocity={x:0,y:0,z:0};},arm);
 await page.waitForTimeout(1000);
 const car=await page.evaluate((arm:number)=>{
  const g=(window as any).__game,m=g.missionForProfiling(),r=m.ropes.find(arm),p=r.segments[r.wound];
  return m.vehicles.create(400,{x:p.x,y:p.y,z:-100},0) as number;
 },arm);
 await page.waitForFunction((c:number)=>(window as any).__game.missionForProfiling().vehicles.positionOf(c)?.z>-50,car,{timeout:60000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const grabbed=()=>w('grabEntityOnRopeForObject',arm) as Promise<{vehicle:number;ped:number;object:number}>;
 // Refused first: let all the way down onto it, the magnet does not take it.
 await w('winchCanPickVehicleUp',car,false);
 await w('setRopeHeightForObject',arm,.05);
 await page.waitForTimeout(4000);
 expect((await grabbed()).vehicle).toBe(-1);
 // Allowed: taken, and wound up it rises.
 await w('winchCanPickVehicleUp',car,true);
 await expect.poll(async()=>(await grabbed()).vehicle,{timeout:20000}).toBe(car);
 const z=()=>page.evaluate((c:number)=>(window as any).__game.missionForProfiling().vehicles.positionOf(c).z as number,car);
 const resting=await z();
 await w('setRopeHeightForObject',arm,.7);
 await expect.poll(z,{timeout:20000}).toBeGreaterThan(resting+5);
 await w('releaseEntityFromRopeForObject',arm);
 const lifted=await z();
 await expect.poll(z,{timeout:10000}).toBeLessThan(lifted-3);
 expect(errors).toEqual([]);
});
