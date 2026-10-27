import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
import reference from '../fixtures/vehicle-training-dispatch-reference.json' with {type:'json'};

for(const model of [471,461])test(`${model===471?'a native automobile quad excludes':'a motorbike invokes'} motorbike-skill training while actually ridden`,async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let result:any,stored:any,restored:any;
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 await page.evaluate(async()=>{
  const path='/src/simulation/nativeMotorbikeTraining.ts',{NativeMotorbikeTraining}=await import(path),g=(window as any).__game;
  const t=(window as any).__motorbikeTraining={original:NativeMotorbikeTraining.prototype.step,seeded:false,rows:[] as any[]};g.missionForProfiling().runtime.game.stats.set(229,0);
  NativeMotorbikeTraining.prototype.step=function(this:any,ts:number,input:any,show:boolean){
   const b=g.fleet().occupiedBike,v=b?.body.linvel(),seeded=!t.seeded&&v&&Math.hypot(v.x,v.z)>2.5;
   if(seeded){t.seeded=true;this.counter=180001;}
   const before=g.missionForProfiling().runtime.game.stats.get(229),counter=this.counter,profile={counter,velocity:[...input.velocity],wheels:input.contactWheels,skill:input.skill,timeStep:Math.fround(ts),showUpdates:show,overrides:{}},result=t.original.call(this,ts,input,show);
   t.rows.push({model:b?.modelId,seeded,before,after:result.skill,counter,counterAfter:this.counter,input:profile,output:{counter:this.counter,...result}});return result;
  };
 });
 try{
  const handle=await page.evaluate(model=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(model,{x:p.x+6,y:-p.z,z:p.y+.5},90);},model);
  await page.waitForFunction(handle=>!!(window as any).__game.missionForProfiling().vehicles.entity(handle),handle,{timeout:60000});
  await page.evaluate(handle=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,handle),handle);
  await page.waitForFunction(model=>(window as any).__game.fleet().occupiedBike?.modelId===model,model,{timeout:30000});
  await page.keyboard.down('KeyW');await page.waitForFunction(()=>{const b=(window as any).__game.fleet().occupiedBike,v=b?.body.linvel();return v&&Math.hypot(v.x,v.z)>3;},undefined,{timeout:30000});await page.keyboard.up('KeyW');
  result=await page.evaluate(()=>({rows:(window as any).__motorbikeTraining.rows,skill:(window as any).__game.missionForProfiling().runtime.game.stats.get(229)}));
  const native=reference.cases.find(r=>r.input.model===model&&r.input.velocity[0]>0)!;
  if(!native.calls.some(c=>c.name==='motorbike')){expect(result.rows).toEqual([]);expect(result.skill).toBe(0);}
  else{expect(result.rows.find((r:any)=>r.seeded)).toMatchObject({model:461,before:0,after:25,counter:180001,counterAfter:0});expect(result.skill).toBe(25);}

 }finally{
  result??={};result.rows=await page.evaluate(()=>(window as any).__motorbikeTraining.rows);
  await page.keyboard.up('KeyW');await page.evaluate(async()=>{const path='/src/simulation/nativeMotorbikeTraining.ts',{NativeMotorbikeTraining}=await import(path);NativeMotorbikeTraining.prototype.step=(window as any).__motorbikeTraining.original;});
  writeFileSync(`artifacts/motorbike-training-dispatch-${model}.json`,JSON.stringify({result,errors},null,2));
 }
 if(model===461){
  await page.reload();stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('web-gta.progress.v1')??'null'));expect(stored.bikeSkill).toBe(25);
  await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
  restored=await page.evaluate(async()=>{const path='/src/simulation/WorldBike.ts',{WorldBike}=await import(path),g=(window as any).__game;return {skill:g.missionForProfiling().runtime.game.stats.get(229),ridingSkill:WorldBike.ridingSkill()};});
  expect(restored).toEqual({skill:25,ridingSkill:.025});
 }
 writeFileSync(`artifacts/motorbike-training-dispatch-${model}.json`,JSON.stringify({result,stored,restored,errors},null,2));
 expect(errors).toEqual([]);
});
