import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('real car and quad driving award native skill, pause at rest and restore their saved skill provider',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let result:any;
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game;return g.sim.player.grounded&&!g.state().terrainHold;},undefined,{timeout:60000});
 await page.evaluate(async()=>{
  const path='/src/simulation/nativeDrivingTraining.ts',{NativeDrivingTraining}=await import(path),g=(window as any).__game;
  const t=(window as any).__drivingTraining={original:NativeDrivingTraining.prototype.step,armed:'',rows:[] as any[],instance:null as any};
  g.missionForProfiling().runtime.game.stats.set(160,40);
  NativeDrivingTraining.prototype.step=function(this:any,ts:number,i:any,show:boolean){
   t.instance=this;const seeded=!!t.armed&&Math.hypot(i.velocity[0],i.velocity[1])>.05,label=seeded?t.armed:'';
   if(seeded){this.counter=300001;t.armed='';}
   const input={counter:this.counter,velocity:[...i.velocity],wheels:i.contactWheels,vehicleType:i.automobile?0:1,skill:i.skill,timeStep:Math.fround(ts),showUpdates:show,overrides:{}};
   const output=t.original.call(this,ts,i,show);
   if(seeded||t.rows.length<100)t.rows.push({seeded,label,model:g.fleet().occupied?.modelId??g.fleet().occupiedBike?.modelId,input,output:{...output,counter:this.counter}});return output;
  };
 });
 const create=async(model:number)=>{
  const handle=await page.evaluate(model=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return m.vehicles.create(model,{x:p.x+6,y:-p.z,z:p.y+.5},90);},model);
  await page.waitForFunction(handle=>!!(window as any).__game.missionForProfiling().vehicles.entity(handle),handle,{timeout:60000});
  await page.evaluate(handle=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,handle),handle);
  await page.waitForFunction(handle=>(window as any).__game.missionForProfiling().runtime.world.pedIsSittingInCar(1,handle),handle,{timeout:30000});return handle;
 };
 try{
  await create(400);await page.evaluate(()=>(window as any).__drivingTraining.armed='car');await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>(window as any).__drivingTraining.rows.some((r:any)=>r.label==='car'),undefined,{timeout:45000});await page.keyboard.up('KeyW');
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.stats.get(160))).toBe(60);
  await page.keyboard.down('Space');
  await page.waitForFunction(()=>{const c=(window as any).__game.fleet().occupied,v=c?.car.body.linvel();return c&&c.wheelsOnGround>0&&Math.hypot(v.x,v.y,v.z)<.3;},undefined,{timeout:20000});
  const idle=await page.evaluate(()=>({minute:(window as any).__game.sim.timeMinutes,counter:(window as any).__drivingTraining.instance.counter}));
  await page.waitForFunction(minute=>((window as any).__game.sim.timeMinutes-minute+1440)%1440>=1,idle.minute,{timeout:30000});expect(await page.evaluate(()=>(window as any).__drivingTraining.instance.counter)).toBe(idle.counter);await page.keyboard.up('Space');
  await create(471);await page.evaluate(()=>(window as any).__drivingTraining.armed='quad');await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>(window as any).__drivingTraining.rows.some((r:any)=>r.label==='quad'),undefined,{timeout:45000});await page.keyboard.up('KeyW');
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.carEntry().drivingSkill)).toBe(80);
  result=await page.evaluate(()=>({rows:(window as any).__drivingTraining.rows,skill:(window as any).__game.missionForProfiling().runtime.game.stats.get(160),provider:(window as any).__game.carEntry().drivingSkill}));
  const seeded=result.rows.filter((r:any)=>r.seeded);expect(seeded.map((r:any)=>[r.label,r.model,r.input.skill,r.output.skill,r.output.counter])).toEqual([['car',400,40,60,0],['quad',471,60,80,0]]);
 }finally{
  await page.keyboard.up('KeyW');await page.keyboard.up('Space');await page.evaluate(async()=>{const path='/src/simulation/nativeDrivingTraining.ts',{NativeDrivingTraining}=await import(path);NativeDrivingTraining.prototype.step=(window as any).__drivingTraining.original;});
  writeFileSync('artifacts/driving-training.json',JSON.stringify({result,errors},null,2));if(result)writeFileSync('artifacts/driving-training-live-inputs.json',JSON.stringify(result.rows,null,2));
 }
 await page.reload();const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('web-gta.progress.v1')??'null').drivingSkill);expect(stored).toBe(80);
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const restored=await page.evaluate(()=>{const g=(window as any).__game;return {stat:g.missionForProfiling().runtime.game.stats.get(160),provider:g.carEntry().drivingSkill};});expect(restored).toEqual({stat:80,provider:80});
 writeFileSync('artifacts/driving-training.json',JSON.stringify({result,stored,restored,errors},null,2));expect(errors).toEqual([]);
});
