import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
import reference from '../fixtures/vehicle-training-dispatch-reference.json' with {type:'json'};

for(const model of [471,461])test(`${model===471?'a native automobile quad excludes':'a motorbike invokes'} motorbike-skill training while actually ridden`,async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let result:any;
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 await page.evaluate(async()=>{
  const path='/src/simulation/nativeStatReactions.ts',{NativeStatReactions}=await import(path),g=(window as any).__game;
  const t=(window as any).__motorbikeTraining={original:NativeStatReactions.prototype.onMotorBike,seeded:false,rows:[] as any[]};g.missionForProfiling().runtime.game.stats.set(229,0);
  NativeStatReactions.prototype.onMotorBike=function(this:any,...args:any[]){
   const b=g.fleet().occupiedBike,v=b?.body.linvel(),seeded=!t.seeded&&v&&Math.hypot(v.x,v.z)>2.5;
   if(seeded){t.seeded=true;this.bikeCounter=180001;}
   const before=g.missionForProfiling().runtime.game.stats.get(229),counter=this.bikeCounter,result=t.original.apply(this,args);
   t.rows.push({model:b?.modelId,seeded,before,after:g.missionForProfiling().runtime.game.stats.get(229),counter,counterAfter:this.bikeCounter});return result;
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
  await page.keyboard.up('KeyW');await page.evaluate(async()=>{const path='/src/simulation/nativeStatReactions.ts',{NativeStatReactions}=await import(path);NativeStatReactions.prototype.onMotorBike=(window as any).__motorbikeTraining.original;});
  writeFileSync(`artifacts/motorbike-training-dispatch-${model}.json`,JSON.stringify({result,errors},null,2));
 }
 expect(errors).toEqual([]);
});
