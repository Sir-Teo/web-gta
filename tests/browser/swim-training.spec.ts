import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('ordinary underwater and surface swimming train separate native stats while dry land and treading pause training',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const origin=await page.evaluate(async()=>{
  const path='/src/simulation/nativeStatReactions.ts',g=(window as any).__game,{NativeStatReactions}=await import(path),proto=NativeStatReactions.prototype;
  const s=(window as any).__swimTraining={rows:[] as any[],footRows:[] as string[],seed:'both',original:{swimming:proto.swimming,running:proto.running,sprinting:proto.sprinting}};
  proto.swimming=function(this:any,ts:number,underwater:boolean,sprinting:boolean){
   // Seed counters past their original limits; ordinary game frames perform the actual awards.
   if(s.seed){this.swimStaminaCounter=180001;if(s.seed==='both')this.underwaterCounter=60001;s.seed='';}
   const stats=g.missionForProfiling().runtime.game.stats,before={stamina:stats.get(22),lung:stats.get(225),breath:g.sim.player.breath};
   const rate=s.original.swimming.call(this,ts,underwater,sprinting);
   s.rows.push({ts,underwater,sprinting,rate,before,after:{stamina:stats.get(22),lung:stats.get(225),breath:g.sim.player.breath,capacity:g.sim.playerLungCapacity()},counters:{swim:this.swimStaminaCounter,underwater:this.underwaterCounter}});return rate;
  };
  for(const name of ['running','sprinting'] as const)proto[name]=function(this:any,ms:number){if(g.sim.player.swimming)s.footRows.push(name);return s.original[name].call(this,ms);};
  return {...g.sim.player.position};
 });
 const goto=async(x:number,y:number,z:number)=>page.evaluate(p=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinatesNoOffset(1,p.x,p.y,p.z),{x,y,z});
 const waitReady=async(state?:number)=>page.waitForFunction(state=>{const g=(window as any).__game;return !g.state().terrainHold&&(state===undefined?!g.sim.player.swimming:g.sim.player.swimming&&g.sim.player.swimState===state);},state,{timeout:60000});
 const pauseCount=async()=>{
  const start=await page.evaluate(()=>({minute:(window as any).__game.sim.timeMinutes,count:(window as any).__swimTraining.rows.length}));
  await page.waitForFunction(minute=>((window as any).__game.sim.timeMinutes-minute+1440)%1440>=1,start.minute,{timeout:30000});
  expect(await page.evaluate(()=>(window as any).__swimTraining.rows.length)).toBe(start.count);
 };
 try{
  await goto(2600,-2600,-4);await waitReady(4);
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.stats.get(225)),{timeout:30000}).toBe(50);
  const underwater=await page.evaluate(()=>(window as any).__swimTraining.rows.find((r:any)=>r.before.lung===0&&r.after.lung===50));
  expect(underwater).toMatchObject({underwater:true,sprinting:false,rate:15,before:{stamina:100,lung:0},after:{stamina:150,lung:50,capacity:1300},counters:{swim:0,underwater:0}});
  expect(underwater.after.breath).toBe(underwater.before.breath);
  await goto(origin.x,-origin.z,origin.y);await waitReady();await pauseCount();
  await goto(2600,-2600,-1.7);await waitReady(0);await pauseCount();
  await page.evaluate(()=>(window as any).__swimTraining.seed='surface');await page.keyboard.down('KeyW');
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.stats.get(22)),{timeout:30000}).toBe(200);await page.keyboard.up('KeyW');
  const surface=await page.evaluate(()=>(window as any).__swimTraining.rows.find((r:any)=>r.before.stamina===150&&r.after.stamina===200));
  expect(surface).toMatchObject({underwater:false,sprinting:false,rate:10,before:{lung:50},after:{stamina:200,lung:50,capacity:1375},counters:{swim:0}});
  expect(await page.evaluate(()=>(window as any).__swimTraining.footRows)).toEqual([]);
  await page.screenshot({path:'artifacts/swim-training.png'});
 }finally{
  await page.keyboard.up('KeyW');const result=await page.evaluate(async()=>{const path='/src/simulation/nativeStatReactions.ts',{NativeStatReactions}=await import(path),s=(window as any).__swimTraining;Object.assign(NativeStatReactions.prototype,s.original);return {rows:s.rows,footRows:s.footRows};});
  writeFileSync('artifacts/swim-training.json',JSON.stringify({...result,errors},null,2));
 }
 expect(errors).toEqual([]);
});
