import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
import reference from '../fixtures/body-exercise-reference.json' with {type:'json'};

test('ordinary exercise applies captured body changes, pauses while idle and saves all earned stats across reload',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let result:any;
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game;return !g.state().terrainHold&&g.sim.player.grounded&&g.sim.footMove==='still';},undefined,{timeout:60000});
 await page.evaluate(async()=>{
  const path='/src/simulation/nativeBodyExercise.ts',{NativeBodyExercise}=await import(path),g=(window as any).__game;
  g.missionForProfiling().runtime.game.showUpdateStats=true;
  const t=(window as any).__bodyExercise={original:NativeBodyExercise.prototype.step,seedRate:0,seedHealth:0,rows:[] as any[]};
  NativeBodyExercise.prototype.step=function(this:any,ts:number,rate:number,stats:any,show:boolean){
   const seeded=t.seedRate===rate;if(seeded){this.fatCounter=150001;this.healthCounter=t.seedHealth;t.seedRate=0;}
   const input={...stats,timeStep:Math.fround(ts),exerciseRate:rate,fatCounter:this.fatCounter,healthCounter:this.healthCounter,messageState:this.messageState,showUpdates:show};
   const output=t.original.call(this,ts,rate,stats,show);
   t.rows.push({seeded,input,mode:g.sim.player.swimming?'swimming':g.sim.footMove,output:{...stats,fatCounter:this.fatCounter,healthCounter:this.healthCounter,messageState:this.messageState,checks:output.checks,messages:output.messages}});return output;
  };
 });
 const pauseCount=async()=>{const start=await page.evaluate(()=>({minute:(window as any).__game.sim.timeMinutes,count:(window as any).__bodyExercise.rows.length}));await page.waitForFunction(minute=>((window as any).__game.sim.timeMinutes-minute+1440)%1440>=1,start.minute,{timeout:30000});expect(await page.evaluate(()=>(window as any).__bodyExercise.rows.length)).toBe(start.count);};
 const waitSeed=async(rate:number)=>page.waitForFunction(rate=>(window as any).__bodyExercise.rows.some((r:any)=>r.seeded&&r.input.exerciseRate===rate),rate,{timeout:30000});
 try{
  await pauseCount();
  await page.evaluate(()=>{const t=(window as any).__bodyExercise;t.seedRate=5;t.seedHealth=600001;});await page.keyboard.down('KeyW');await waitSeed(5);await page.keyboard.up('KeyW');
  await page.waitForFunction(()=>(window as any).__game.sim.footMove==='still');await pauseCount();
  await page.evaluate(()=>{const t=(window as any).__bodyExercise;t.seedRate=10;t.seedHealth=0;});await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await waitSeed(10);await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
  await page.evaluate(()=>{const g=(window as any).__game,t=(window as any).__bodyExercise;g.missionForProfiling().runtime.game.stats.set(21,0);t.seedRate=15;t.seedHealth=0;g.missionForProfiling().runtime.world.setPedCoordinatesNoOffset(1,2600,-2600,-4);});await waitSeed(15);
  result=await page.evaluate(()=>({rows:(window as any).__bodyExercise.rows,stats:[21,23,24].map(id=>(window as any).__game.missionForProfiling().runtime.game.stats.get(id))}));
  const seeded=result.rows.filter((r:any)=>r.seeded);expect(seeded).toHaveLength(3);expect(seeded.map((r:any)=>r.mode)).toEqual(['run','sprint','swimming']);
  for(const row of seeded){
   const native=reference.cases.find(r=>r.input.fat===row.input.fat&&r.input.muscle===row.input.muscle&&r.input.maxHealth===row.input.maxHealth&&r.input.timeStep===row.input.timeStep&&r.input.exerciseRate===row.input.exerciseRate&&r.input.fatCounter===row.input.fatCounter&&r.input.healthCounter===row.input.healthCounter&&r.input.messageState===row.input.messageState&&r.input.showUpdates===row.input.showUpdates&&Object.keys(r.input.overrides).length===0)!;
   expect(native).toBeDefined();
   expect(row.output).toEqual({fat:native.fat,muscle:native.muscle,maxHealth:native.maxHealth,fatCounter:native.fatCounter,healthCounter:native.healthCounter,messageState:native.messageState,checks:native.external.filter(e=>e.name==='CheckForStatsMessage').length,messages:native.external.filter(e=>e.name==='DisplayScriptStatUpdateMessage').map(e=>({increase:e.increase,stat:e.stat,value:e.value,max:e.max}))});
  }
  expect(result.stats).toEqual([0,55,589]);await page.screenshot({path:'artifacts/body-exercise.png'});
 }finally{
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await page.evaluate(async()=>{const path='/src/simulation/nativeBodyExercise.ts',{NativeBodyExercise}=await import(path);NativeBodyExercise.prototype.step=(window as any).__bodyExercise.original;});
  writeFileSync('artifacts/body-exercise.json',JSON.stringify({result,errors},null,2));
 }
 // Ordinary pagehide saves the earned native values; a fresh MAIN must not replace them.
 await page.reload();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('web-gta.progress.v1')??'null').trainingStats);
 expect(stored).toMatchObject({fat:0,muscle:55,maxHealth:589});
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const restored=await page.evaluate(()=>{const game=(window as any).__game.missionForProfiling().runtime.game;return {stats:[21,23,24].map(id=>game.stats.get(id)),playerInfoMaxHealth:game.playerInfo.maxHealth};});
 expect(restored).toEqual({stats:[0,55,589],playerInfoMaxHealth:100});
 writeFileSync('artifacts/body-exercise.json',JSON.stringify({result,stored,restored,errors},null,2));
 expect(errors).toEqual([]);
});
