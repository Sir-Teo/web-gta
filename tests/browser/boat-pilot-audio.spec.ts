import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('SCM boat navigation drives propeller and native engine audio without CJ aboard, stops and restarts',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const handle=await page.evaluate(()=>{const g=(window as any).__game;g.sim.playerCanBeDamaged=false;g.missionForProfiling().runtime.world.setPedCoordinatesNoOffset(1,2600,-2600,-.5);return g.missionForProfiling().runtime.world.createCar(452,2600,-2608,0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)?.body,handle,{timeout:60000});
 const read=()=>page.evaluate(h=>{const g=(window as any).__game,b=g.missionForProfiling().vehicles.entity(h),native=g.state().audio.native,matches=native?.vehicles.filter((a:any)=>a.model===452)??[];if(matches.length>1)throw Error('Ambiguous Speeder audio entity');const a=matches[0];return {occupied:b.occupied,prop:b.engineSpeed,gas:b.gasPedal,pilot:b.pilot?{...b.pilot}:null,position:{...b.body.translation()},audio:a,banks:native?.banks.slots};},handle);
 const rows:any[]=[];let headingControls:any[]=[];
 try{
  await page.waitForFunction(()=>{const s=(window as any).__game.state();return !s.terrainHold&&s.audio.context==='running';},undefined,{timeout:45000});
  await expect.poll(async()=>!!(await read()).audio,{timeout:30000}).toBe(true);rows.push({mode:'parked',...await read()});expect(rows[0].audio.sounds).not.toContain(2);
  headingControls=await page.evaluate(h=>{
   const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,b=m.vehicles.entity(h),p=b.body.translation(),out=[];
   // Actual SCM heading/mission state and Rapier quaternion pass through WorldBoat's control adapter.
   // Sample synchronously so water forces cannot rotate the bow between the exact-astern cases.
   for(const speed of [0,10]){
    w.setVehicleHeading(h,90);b.body.setLinvel({x:speed,y:0,z:0},true);w.boatGotoCoords(h,p.x+50,-p.z,0);b.controlInputs(1/50);
    out.push({speed,rotation:{...b.body.rotation()},steer:b.steerAngle,gas:b.gasPedal,brake:b.brakePedal,occupied:b.occupied,pilot:{...b.pilot}});
   }
   b.body.setLinvel({x:0,y:0,z:0},true);w.setVehicleHeading(h,0);w.boatStop(h);return out;
  },handle);
  expect(headingControls[0]).toMatchObject({steer:.5,gas:1,brake:0,occupied:false,pilot:{physics:true,engineOn:true}});
  expect(headingControls[1]).toMatchObject({steer:-.5,gas:Math.fround(-.1),brake:0});
  for(const mode of ['goto','restart']){
   await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.boatGotoCoords(h,2600,-2500,0),handle);
   await expect.poll(async()=>{const r=await read();return r.prop>(mode==='goto'?.2:.1)&&r.audio?.sounds.includes(2);},{timeout:45000}).toBe(true);
   const running=await read();rows.push({mode,...running});expect(running.occupied).toBe(false);expect(running.audio.player).toBe(false);expect(running.pilot).toMatchObject({physics:true,engineOn:true});expect(running.banks.some(([slot,bank]:number[])=>slot===running.audio.dummySlot&&bank===21)).toBe(true);
   await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.boatStop(h),handle);
   await expect.poll(async()=>{const r=await read();return r.pilot?.engineOn===false&&!r.audio?.sounds.includes(2)&&r.prop<Math.min(.1,running.prop/2);},{timeout:30000}).toBe(true);rows.push({mode:mode==='goto'?'stop':'final stop',...await read()});
  }
 }catch(error){rows.push({mode:'failure',snapshot:await read(),world:await page.evaluate(()=>{const s=(window as any).__game.state();return {audio:s.audio,paused:s.paused,terrainHold:s.terrainHold,following:s.following,faults:s.subsystemFaults,player:s.player.position};})});throw error;}finally{writeFileSync('artifacts/boat-pilot-audio.json',JSON.stringify({rows,headingControls,errors},null,2));await page.evaluate(h=>{const g=(window as any).__game;g.missionForProfiling().runtime.world.deleteVehicle(h);g.sim.playerCanBeDamaged=true;},handle);}
 expect(rows).toHaveLength(5);expect(errors).toEqual([]);
});
