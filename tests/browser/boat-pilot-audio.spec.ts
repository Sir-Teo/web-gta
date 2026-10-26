import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('SCM boat navigation drives propeller and native engine audio without CJ aboard, stops and restarts',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const handle=await page.evaluate(()=>{const g=(window as any).__game;g.sim.playerCanBeDamaged=false;g.placePlayer(2600,3,2600);return g.missionForProfiling().runtime.world.createCar(452,2600,-2608,0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)?.body,handle,{timeout:60000});
 const read=()=>page.evaluate(h=>{const g=(window as any).__game,b=g.missionForProfiling().vehicles.entity(h),native=g.state().audio.native,matches=native?.vehicles.filter((a:any)=>a.model===452)??[];if(matches.length>1)throw Error('Ambiguous Speeder audio entity');const a=matches[0];return {occupied:b.occupied,prop:b.engineSpeed,gas:b.gasPedal,pilot:b.pilot?{...b.pilot}:null,position:{...b.body.translation()},audio:a,banks:native?.banks.slots};},handle);
 const rows:any[]=[];
 try{
  await expect.poll(async()=>!!(await read()).audio,{timeout:30000}).toBe(true);rows.push({mode:'parked',...await read()});expect(rows[0].audio.sounds).not.toContain(2);
  for(const mode of ['goto','restart']){
   await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.boatGotoCoords(h,2600,-2500,0),handle);
   await expect.poll(async()=>{const r=await read();return r.prop>(mode==='goto'?.2:.1)&&r.audio?.sounds.includes(2);},{timeout:45000}).toBe(true);
   const running=await read();rows.push({mode,...running});expect(running.occupied).toBe(false);expect(running.audio.player).toBe(false);expect(running.pilot).toMatchObject({physics:true,engineOn:true});expect(running.banks.some(([slot,bank]:number[])=>slot===running.audio.dummySlot&&bank===21)).toBe(true);
   await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.boatStop(h),handle);
   await expect.poll(async()=>{const r=await read();return r.pilot?.engineOn===false&&!r.audio?.sounds.includes(2)&&r.prop<Math.min(.1,running.prop/2);},{timeout:30000}).toBe(true);rows.push({mode:mode==='goto'?'stop':'final stop',...await read()});
  }
 }finally{writeFileSync('artifacts/boat-pilot-audio.json',JSON.stringify({rows,errors},null,2));await page.evaluate(h=>{const g=(window as any).__game;g.missionForProfiling().runtime.world.deleteVehicle(h);g.sim.playerCanBeDamaged=true;},handle);}
 expect(rows).toHaveLength(5);expect(errors).toEqual([]);
});
