import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('SYN6’s targetable vehicle flag reaches live occupant selection without changing bullet eligibility',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const cars=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return [487,461].map((model,i)=>m.vehicles.create(model,{x:p.x+12+i*12,y:-p.z,z:p.y},0));});
 await page.waitForFunction(hs=>hs.every(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)),cars,{timeout:60000});
 const riders=await page.evaluate(cars=>{const m=(window as any).__game.missionForProfiling();return cars.map(car=>m.peds.createInCar(4,'MALE01',car,'driver'));},cars);
 await page.waitForFunction(hs=>hs.every(h=>!!(window as any).__game.missionForProfiling().peds.entity(h)),riders,{timeout:60000});
 // Wait for their real head nodes, then use the same target picker as the touch camera with its ray centered on them.
 await page.waitForFunction(cars=>{const g=(window as any).__game,m=g.missionForProfiling();return cars.every(h=>!!g.occupants().headOf(`script:${m.vehicles.entity(h).car.body.handle}:driver`));},cars,{timeout:60000});
 const result=await page.evaluate(async({cars,riders})=>{
  const scmPath='/src/assets/scm.ts',aimPath='/src/input/aimAssist.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ scmPath),{pickAimTarget}=await import(/* @vite-ignore */ aimPath),g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),heli=m.vehicles.entity(cars[0]),bike=m.vehicles.entity(cars[1]);
  const targetFor=(car:any)=>{const head=g.occupants().headOf(`script:${car.car.body.handle}:driver`);return w.automaticAimTargets().find((c:any)=>Math.hypot(c.position.x-head.x,c.position.y-head.y,c.position.z-head.z)<.01);};
  const before={heli:!!targetFor(heli),bike:!!targetFor(bike)};heli.hsTargetable=false;
  const bytes=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(bytes).missions[62],site=decodeScmInstructions(bytes,block.start,block.end).find((i:any)=>i.opcode===0x84e),code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(149*4,cars[0],true);slot.thread.run(g.gameTimeMs(),100,1);
  const candidate=targetFor(heli),origin={...candidate.position,z:candidate.position.z+5},ray={origin,direction:{x:0,y:0,z:-1}},picked=pickAimTarget(w.automaticAimTargets(),ray,origin,50)?.handle;
  const seat=w.seatedPeds().find((t:any)=>t.rider===m.peds.entity(riders[0])),head=seat.head,source={...head,y:head.y+.1,z:head.z+5},hit=()=>w.seatedHit(source,{x:0,y:0,z:-1},10,heli.car.body)?.target.rider===seat.rider;
  m.runtime.world.setVehicleCanBeTargetted(cars[0],false);const disabled={candidate:!!targetFor(heli),bullet:hit(),hs:heli.hsTargetable};m.runtime.world.setVehicleCanBeTargetted(cars[0],true);const stable=targetFor(heli)?.handle===candidate.handle;
  m.runtime.world.setPedNeverTargeted(riders[0],true);const never=!!targetFor(heli);m.runtime.world.setPedNeverTargeted(riders[0],false);m.runtime.world.setPedCanBeShotInVehicle(riders[0],false);const proof={target:!!targetFor(heli),bullet:hit()};m.runtime.world.setVehicleCanBeTargetted(cars[1],false);
  return {before,selected:picked===candidate.handle,disabled,stable,never,proof,bike:!!targetFor(bike),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },{cars,riders});
 expect(result).toMatchObject({before:{heli:false,bike:true},selected:true,disabled:{candidate:false,bullet:true,hs:false},stable:true,never:false,proof:{target:true,bullet:false},bike:true,skipped:[],gaveUp:[]});
 await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;m.runtime.world.setPedNeverTargeted(h,true);m.runtime.world.warpPedFromCarToCoord(h,p.x+6,-p.z,p.y);},riders[0]);
 await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return p&&!p.rider;},riders[0],{timeout:30000});
 expect(await page.evaluate(h=>{const g=(window as any).__game,p=g.missionForProfiling().peds.entity(h);return {never:p.neverTargeted,canBeShot:p.flags.canBeShotInVehicle,inTargets:g.weapons().automaticAimTargets().some((t:any)=>t.handle===p.collider.handle)};},riders[0])).toEqual({never:true,canBeShot:false,inTargets:false});
 await page.evaluate(({h,car})=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(h,car),{h:riders[0],car:cars[0]});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h)?.rider,riders[0],{timeout:30000});
 expect(await page.evaluate(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return {never:p.neverTargeted,canBeShot:p.canBeShotInVehicle};},riders[0])).toEqual({never:true,canBeShot:false});expect(errors).toEqual([]);
});
