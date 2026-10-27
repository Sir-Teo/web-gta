import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('real bicycle riding awards native cycling/body/stamina stats and restores earned skill after MAIN',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let result:any,stored:any,restored:any;
 const play=()=>page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.goto('/');await play();await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 await page.evaluate(async()=>{
  const cyclingPath='/src/simulation/nativeCyclingTraining.ts',bodyPath='/src/simulation/nativeBodyExercise.ts';
  const [{NativeCyclingTraining},{NativeBodyExercise}]=await Promise.all([import(cyclingPath),import(bodyPath)]),g=(window as any).__game,s=g.missionForProfiling().runtime.game.stats;
  s.set(165,-1);g.missionForProfiling().runtime.game.showUpdateStats=true;
  const t=(window as any).__cyclingTraining={original:NativeCyclingTraining.prototype.step,bodyOriginal:NativeBodyExercise.prototype.step,seeded:false,inside:false,seedBody:false,body:{fatCounter:0,healthCounter:0,messageState:0},rows:[] as any[],current:undefined as any};
  NativeBodyExercise.prototype.step=function(this:any,ts:number,rate:number,stats:any,show:boolean){
   if(t.inside&&t.seedBody){this.fatCounter=150001;this.healthCounter=600001;t.seedBody=false;}
   if(t.inside)Object.assign(t.current.input,{fatCounter:this.fatCounter,healthCounter:this.healthCounter});
   const out=t.bodyOriginal.call(this,ts,rate,stats,show);t.body={fatCounter:this.fatCounter,healthCounter:this.healthCounter,messageState:this.messageState};
   if(t.inside){t.current.bodyChecks=out.checks;t.current.bodyMessages=out.messages;}return out;
  };
  NativeCyclingTraining.prototype.step=function(this:any,ts:number,input:any,stats:any,show:boolean){
   const seeded=!t.seeded&&(input.gas!==0||input.boost);if(seeded){t.seeded=true;this.staminaCounter=300001;this.skillCounter=120001;t.seedBody=true;}
   const row:any=t.current={seeded,model:g.fleet().occupiedBike?.modelId,input:{boost:input.boost,gas:input.gas,velocity:[...input.velocity].map(Math.fround),wheels:input.contactWheels,staminaCounter:this.staminaCounter,skillCounter:this.skillCounter,timeStep:Math.fround(ts),fat:stats.get(21),stamina:stats.get(22),muscle:stats.get(23),maxHealth:stats.get(24),skill:input.skill,energy:stats.get(165),fatCounter:t.body.fatCounter,healthCounter:t.body.healthCounter,showUpdates:show,overrides:{}},bodyChecks:0,bodyMessages:[]};
   t.inside=true;const out=t.original.call(this,ts,input,stats,show);t.inside=false;
   row.output={fat:stats.get(21),stamina:stats.get(22),muscle:stats.get(23),maxHealth:stats.get(24),skill:out.skill,staminaCounter:this.staminaCounter,skillCounter:this.skillCounter,...t.body,checks:row.bodyChecks+out.checks,messages:[...row.bodyMessages,...out.messages]};t.rows.push(row);return out;
  };
 });
 try{
  const handle=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(481,{x:p.x+6,y:-p.z,z:p.y+.5},90);});
  await page.waitForFunction(handle=>!!(window as any).__game.missionForProfiling().vehicles.entity(handle),handle,{timeout:60000});
  await page.evaluate(handle=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,handle),handle);
  await page.waitForFunction(()=>(window as any).__cyclingTraining.rows.some((r:any)=>!r.input.gas&&!r.input.boost),undefined,{timeout:15000});
  await page.keyboard.down('KeyW');await page.waitForFunction(()=>(window as any).__cyclingTraining.rows.some((r:any)=>r.seeded),undefined,{timeout:15000});await page.keyboard.up('KeyW');
  await page.waitForFunction(()=>{const r=(window as any).__cyclingTraining.rows;return r.filter((r:any)=>!r.input.gas&&!r.input.boost).length>15;},undefined,{timeout:30000});
  result=await page.evaluate(()=>({rows:(window as any).__cyclingTraining.rows,stats:[21,22,23,24,230].map(id=>(window as any).__game.missionForProfiling().runtime.game.stats.get(id))}));
  const award=result.rows.find((r:any)=>r.seeded);expect(award.model).toBe(481);expect(award.input).toMatchObject({staminaCounter:300001,skillCounter:120001,fatCounter:150001,healthCounter:600001,boost:true,gas:1,stamina:100,fat:200,muscle:50,maxHealth:569,skill:0,energy:-1});
  expect(award.output).toMatchObject({fat:162,stamina:150,muscle:60,maxHealth:589,skill:50,staminaCounter:0,skillCounter:0});expect(award.output.messages.map((m:any)=>m.stat)).toEqual([21,24,22,230]);
  expect(result.stats).toEqual([162,150,60,589,50]);
  const idle=result.rows.filter((r:any)=>!r.input.gas&&!r.input.boost);expect(idle.every((r:any)=>r.output.staminaCounter===r.input.staminaCounter&&r.bodyChecks===0)).toBe(true);
 }finally{
  await page.keyboard.up('KeyW');
  await page.evaluate(async()=>{const cyclingPath='/src/simulation/nativeCyclingTraining.ts',bodyPath='/src/simulation/nativeBodyExercise.ts';const [{NativeCyclingTraining},{NativeBodyExercise}]=await Promise.all([import(cyclingPath),import(bodyPath)]),t=(window as any).__cyclingTraining;NativeCyclingTraining.prototype.step=t.original;NativeBodyExercise.prototype.step=t.bodyOriginal;});
  writeFileSync('artifacts/cycling-training-live.json',JSON.stringify({result,errors},null,2));
 }
 await page.reload();stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('web-gta.progress.v1')??'null'));expect(stored.cyclingSkill).toBe(50);expect(stored.trainingStats).toMatchObject({fat:162,stamina:150,muscle:60,maxHealth:589});
 await play();await endStoryMission(page);
 restored=await page.evaluate(()=>{const g=(window as any).__game,s=g.missionForProfiling().runtime.game.stats;return {stats:[21,22,23,24,230].map(id=>s.get(id)),capacity:g.sim.playerSprintCapacity()};});
 expect(restored).toEqual({stats:[162,150,60,589,50],capacity:600});
 writeFileSync('artifacts/cycling-training-live.json',JSON.stringify({result,stored,restored,errors},null,2));expect(errors).toEqual([]);
});
