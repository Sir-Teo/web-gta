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
 await page.waitForTimeout(3000);
 const container=await page.evaluate((arm:number)=>{
  const g=(window as any).__game,m=g.missionForProfiling(),r=m.ropes.find(arm),p=r.segments[31],ground=g.groundAt(p.x,-p.y,p.z+5);
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
