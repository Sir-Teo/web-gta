import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
import reference from '../fixtures/ground-training-reference.json' with {type:'json'};

test('real running and sprinting award native stamina after body exercise and pause their counters while idle',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let rows:any[]=[];
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game;return g.sim.player.grounded&&!g.state().terrainHold&&g.sim.footMove==='still';},undefined,{timeout:60000});
 await page.evaluate(async()=>{
  const reactionPath='/src/simulation/nativeStatReactions.ts',bodyPath='/src/simulation/nativeBodyExercise.ts';
  const {NativeStatReactions}=await import(reactionPath),{NativeBodyExercise}=await import(bodyPath),g=(window as any).__game;
  g.missionForProfiling().runtime.game.showUpdateStats=false;
  const t=(window as any).__groundTraining={running:NativeStatReactions.prototype.running,sprinting:NativeStatReactions.prototype.sprinting,body:NativeBodyExercise.prototype.step,armed:'running',active:null as any,rows:[] as any[],instance:null as any};
  NativeBodyExercise.prototype.step=function(this:any,ts:number,rate:number,stats:any,show:boolean){
   if(t.active){this.fatCounter=0;this.healthCounter=0;t.active.input={...stats,timeStep:Math.fround(ts),exerciseRate:rate,showUpdates:show,fatCounter:0,healthCounter:0,messageState:this.messageState};}
   const result=t.body.call(this,ts,rate,stats,show);
   if(t.active)t.active.body={...stats,fatCounter:this.fatCounter,healthCounter:this.healthCounter,messageState:this.messageState};return result;
  };
  for(const mode of ['running','sprinting'] as const)NativeStatReactions.prototype[mode]=function(this:any,ms:number){
   const key=mode==='running'?'runningCounter':'sprintStaminaCounter',seeded=t.armed===mode;
   if(seeded){t.armed='';this[key]=300001;t.instance=this;t.active={mode,counter:300001,stamina:g.missionForProfiling().runtime.game.stats.get(22)};}
   const result=t[mode].call(this,ms);
   if(seeded){t.active.counterAfter=this[key];t.active.staminaAfter=g.missionForProfiling().runtime.game.stats.get(22);t.rows.push(t.active);t.active=null;}return result;
  };
 });
 try{
  await page.keyboard.down('KeyW');await page.waitForFunction(()=>(window as any).__groundTraining.rows.length===1);await page.keyboard.up('KeyW');
  await page.waitForFunction(()=>(window as any).__game.sim.footMove==='still');
  const idle=await page.evaluate(()=>{const t=(window as any).__groundTraining;return {minute:(window as any).__game.sim.timeMinutes,counter:t.instance.runningCounter};});
  await page.waitForFunction(minute=>((window as any).__game.sim.timeMinutes-minute+1440)%1440>=1,idle.minute,{timeout:30000});expect(await page.evaluate(()=>(window as any).__groundTraining.instance.runningCounter)).toBe(idle.counter);
  await page.evaluate(()=>(window as any).__groundTraining.armed='sprinting');await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.waitForFunction(()=>(window as any).__groundTraining.rows.length===2);
  rows=await page.evaluate(()=>(window as any).__groundTraining.rows);expect(rows.map(r=>[r.mode,r.stamina,r.staminaAfter])).toEqual([['running',100,105],['sprinting',105,115]]);
  for(const row of rows){
   const native=reference.cases.find(r=>r.input.mode===row.mode&&r.input.counter===row.counter&&r.input.stamina===row.stamina&&r.input.timeStep===row.input.timeStep&&r.input.fat===row.input.fat&&r.input.muscle===row.input.muscle&&r.input.maxHealth===row.input.maxHealth&&r.input.energy===0&&r.input.fatCounter===0&&r.input.healthCounter===0&&!r.input.showUpdates&&Object.keys(r.input.overrides).length===0)!;
   expect(native).toBeDefined();expect(row.input.messageState).toBe(0);
   expect(row.counterAfter).toBe(native.counter);expect(row.staminaAfter).toBe(native.stamina);
   expect(row.body).toEqual({fat:native.fat,muscle:native.muscle,maxHealth:native.maxHealth,fatCounter:native.fatCounter,healthCounter:native.healthCounter,messageState:native.messageState});
   expect(row.input.exerciseRate).toBe(native.external.find(e=>e.name==='BodyExercise')!.rate);
  }
 }finally{
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await page.evaluate(async()=>{const a='/src/simulation/nativeStatReactions.ts',b='/src/simulation/nativeBodyExercise.ts',{NativeStatReactions}=await import(a),{NativeBodyExercise}=await import(b),t=(window as any).__groundTraining;NativeStatReactions.prototype.running=t.running;NativeStatReactions.prototype.sprinting=t.sprinting;NativeBodyExercise.prototype.step=t.body;});
  writeFileSync('artifacts/ground-training.json',JSON.stringify({rows,errors},null,2));
 }
 expect(errors).toEqual([]);
});
