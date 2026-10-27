import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('bike bumper views use the seat offset and quads keep the automobile camera height',async({page})=>{
 test.setTimeout(240000);mkdirSync('artifacts',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 const origin=await page.evaluate(()=>({...((window as any).__game.sim.player.position)}));
 await page.evaluate(async()=>{
  const path='/src/simulation/recordingBody.ts',{nativeMatrixOf}=await import(path),g=(window as any).__game,r=g.render(),original=r.update;
  g.__bikeBumperRows=[];
  r.update=function(this:any,...args:any[]){
   const result=original.apply(this,args),b=g.fleet().occupiedBike;
   if(b&&this.bumperView){
    const seat=b.seat(),expected=b.root.localToWorld(b.root.position.clone().set(0,seat.z+.62,-seat.y-.08)),camera=this.camera.position;
    g.__bikeBumperRows.push({model:b.modelId,quad:b.quad,sourceInput:{boat:false,dummy:[seat.x,seat.y,seat.z],matrix:nativeMatrixOf(b.root.quaternion,b.root.position)},camera:camera.toArray(),expected:expected.toArray(),horizontalError:Math.hypot(camera.x-expected.x,camera.z-expected.z),error:camera.distanceTo(expected),fov:this.fov});
   }
   return result;
  };
  g.__restoreBikeBumper=()=>{r.update=original;};
 });
 const rows:any[]=[];
 try{
  for(const [index,id] of [448,461,462,463,468,471,481,509,510,521,522,523,581,586].entries()){
   const handle=await page.evaluate(({id,index,p})=>(window as any).__game.missionForProfiling().vehicles.create(id,{x:p.x+6,y:-p.z+12,z:-100},index*23),{id,index,p:origin});
   await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),handle,{timeout:60000});
   await page.evaluate(h=>{const g=(window as any).__game;g.missionForProfiling().runtime.world.warpPedIntoCar(1,h);g.render().cameraSettings.vehicle='bumper';g.__bikeBumperRows=[];},handle);
   await page.waitForFunction(id=>(window as any).__game.__bikeBumperRows.filter((r:any)=>r.model===id).length>=10,id,{timeout:30000});
   rows.push(...await page.evaluate(()=>(window as any).__game.__bikeBumperRows.slice(-10)));await page.screenshot({path:`artifacts/bike-bumper-camera-${id}.png`});
   await page.evaluate(({h,p})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.warpPedFromCarToCoord(1,p.x,-p.z,p.y+1);w.deleteVehicle(h);},{h:handle,p:origin});
  }
 }finally{await page.evaluate(()=>(window as any).__game.__restoreBikeBumper?.());writeFileSync('artifacts/bike-bumper-camera-live.json',JSON.stringify({rows,errors},null,2));}
 expect(rows).toHaveLength(140);for(const row of rows){expect(row.quad?row.error:row.horizontalError,JSON.stringify(row)).toBeLessThan(1e-5);expect(row.fov).toBe(60);}expect(errors).toEqual([]);
});
