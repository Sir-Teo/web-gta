import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('riding a BMX updates native sprint energy and retained pedal input through actual keys',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 const handle=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(481,{x:p.x+6,y:-p.z,z:p.y+.5},90);});
 await page.waitForFunction(handle=>!!(window as any).__game.missionForProfiling().vehicles.entity(handle),handle,{timeout:60000});
 await page.evaluate(handle=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,handle),handle);
 await page.waitForFunction(()=>(window as any).__game.fleet().occupiedBike?.modelId===481);
 // Observe real host steps; only energy is seeded to expose recovery before capacity.
 await page.evaluate(async()=>{
  const path='/src/simulation/WorldBike.ts',{WorldBike}=await import(path),g=(window as any).__game;
  g.sim.player.stamina=100;g.sim.player.sprintButtonSpeed=0;
  const t=(window as any).__bmxEnergy={original:WorldBike.prototype.beforeStep,afterOriginal:WorldBike.prototype.afterStep,pending:new WeakMap(),rows:[] as any[]};
  WorldBike.prototype.beforeStep=function(this:any,dt:number,input:any){
   const p=g.sim.player,before=p.stamina,button=p.sprintButtonSpeed,time=this.rideTime;
   const result=t.original.call(this,dt,input);
   if(this.occupied){const row={dt,input,before,after:p.stamina,button,buttonAfter:p.sprintButtonSpeed,boost:this.playerBoost,gas:this.gasPedal,steer:this.steer,coefficient:this.pedalCoefficient,time,timeAfter:this.rideTime};t.rows.push(row);t.pending.set(this,row);}return result;
  };
  WorldBike.prototype.afterStep=function(this:any){const result=t.afterOriginal.call(this),row=t.pending.get(this);if(row){row.timeAfter=this.rideTime;t.pending.delete(this);}return result;};
 });
 let result:any,stage="idle";
 try{
  await page.waitForFunction(()=>(window as any).__bmxEnergy.rows.some((r:any)=>r.after>r.before),undefined,{timeout:15000});
  stage='accelerate';await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>(window as any).__bmxEnergy.rows.some((r:any)=>r.input.throttle>0&&r.boost&&r.before===r.after),undefined,{timeout:15000});
  stage='turn';await page.keyboard.down('KeyD');
  await page.waitForFunction(()=>(window as any).__bmxEnergy.rows.some((r:any)=>r.input.throttle>0&&Math.abs(r.steer)>.1&&!r.boost&&r.after>r.before),undefined,{timeout:15000});
  stage='pedal';await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(()=>(window as any).__bmxEnergy.rows.some((r:any)=>r.input.sprint&&r.input.throttle===0&&r.gas===1&&r.timeAfter>r.time),undefined,{timeout:15000});
  // Keep the release/press pair in one browser turn: CDP round trips on this host
  // can span six physics steps and decay the released native button memory to zero.
  stage='tap';await page.evaluate(async()=>{
   const target=document.querySelector('canvas')!;
   for(let i=0;i<3;i++){
    target.dispatchEvent(new KeyboardEvent('keyup',{code:'ShiftLeft',key:'Shift',bubbles:true}));
    target.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft',key:'Shift',shiftKey:true,bubbles:true}));
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   }
  });
  await page.waitForFunction(()=>(window as any).__bmxEnergy.rows.some((r:any)=>r.button>5&&r.after<r.before),undefined,{timeout:15000});
  result=await page.evaluate(()=>(window as any).__bmxEnergy.rows);
  const idle=result.find((r:any)=>r.input.throttle===0&&!r.input.sprint&&r.button===0&&r.after>r.before),turn=result.find((r:any)=>r.input.throttle>0&&Math.abs(r.steer)>.1&&!r.boost&&r.button===0&&r.after>r.before);
  expect(idle.after).toBe(Math.fround(idle.before+Math.fround(Math.fround(idle.dt*50)*.5)));
  expect(turn.after).toBe(Math.fround(turn.before+Math.fround(Math.fround(Math.fround(turn.dt*50)*.5)*.5)));
 }finally{
  result??=await page.evaluate(()=>(window as any).__bmxEnergy.rows);
  writeFileSync('artifacts/bmx-player-energy.json',JSON.stringify({stage,result,errors},null,2));
  await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');await page.keyboard.up('ShiftLeft');
  await page.evaluate(async()=>{const path='/src/simulation/WorldBike.ts',{WorldBike}=await import(path);WorldBike.prototype.beforeStep=(window as any).__bmxEnergy.original;WorldBike.prototype.afterStep=(window as any).__bmxEnergy.afterOriginal;});
  writeFileSync('artifacts/bmx-player-energy.json',JSON.stringify({stage,result,errors},null,2));
 }
 expect(errors).toEqual([]);
});
