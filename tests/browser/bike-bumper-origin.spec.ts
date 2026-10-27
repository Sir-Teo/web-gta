import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('bike bumper sources use the interpolated body origin before the lean matrix position shift',async({page})=>{
 test.setTimeout(300000);mkdirSync('artifacts',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});const origin=await page.evaluate(()=>({...((window as any).__game.sim.player.position)}));
 await page.evaluate(async()=>{
  const dep='/src/simulation/recordingBody.ts',{nativeMatrixOf}=await import(dep),g=(window as any).__game,r=g.render(),update=r.update;let previousTick=g.state().tick;g.__originRows=[];
  r.update=function(this:any,...args:any[]){
   const bike=g.__originBike,tick=g.state().tick,timeStep=Math.fround(Math.min(3,(tick-previousTick)*50/60));previousTick=tick;
   if(!bike)return update.apply(this,args);
   const p=bike.body.translation(),previous=bike.previous,alpha=args[1],bodyOrigin={x:previous.x+(p.x-previous.x)*alpha,y:previous.y+(p.y-previous.y)*alpha,z:previous.z+(p.z-previous.z)*alpha},seat=bike.seat(),matrix=nativeMatrixOf(bike.root.quaternion,bike.root.position),bumper=this.bumper,front=this.camera.getWorldDirection(this.camera.position.clone()),up=this.camera.up.clone().applyQuaternion(this.camera.quaternion);let neck:any,query:any;
   if(bumper?.sourceForCamera){const source=bumper.sourceForCamera;bumper.sourceForCamera=()=>{
    const character=this.nativeCharacter,bone=character.bonePosition,world=g.sim.world,cast=world.castRay;
    character.bonePosition=function(this:any,id:number,...args:any[]){const out=bone.call(this,id,...args);if(id===4&&out)neck={x:out.x,y:out.y,z:out.z};return out;};
    world.castRay=function(this:any,...args:any[]){const out=cast.apply(this,args);query={blocked:out!==null};return out;};
    try{return source();}finally{character.bonePosition=bone;world.castRay=cast;}
   };}
   const result=update.apply(this,args);
   if(this.bumperView&&this.glance==='none'){
    const expected=bike.root.position.clone().set(0,seat.z+.62,-seat.y-.08).applyQuaternion(bike.root.quaternion).add(bodyOrigin);if(query?.blocked){expected.x=p.x;expected.z=p.z;}
    const velocity=bike.body.linvel();g.__originRows.push({model:bike.modelId,stage:g.__originStage,alpha,lean:bike.lean,bodyOrigin,rootPosition:bike.root.position.toArray(),previous:{...previous},physicalPosition:{...p},camera:this.camera.position.toArray(),horizontalError:Math.hypot(this.camera.position.x-expected.x,this.camera.position.z-expected.z),query,nativeInput:{vehicleType:bike.quad?0:9,matrix,dummy:[seat.x,seat.y,seat.z],vehiclePosition:[bodyOrigin.x,-bodyOrigin.z,bodyOrigin.y],...(neck?{neck:[neck.x,-neck.z,neck.y],velocity:[velocity.x/50,-velocity.z/50,velocity.y/50],timeStep,front:[front.x,-front.z,front.y],up:[up.x,-up.z,up.y],lineClear:!query?.blocked}:{})}});
   }
   return result;
  };
  g.__restoreOrigin=()=>r.update=update;
 });
 const rows:any[]=[];
 try{
  for(const model of [461,481,586,471]){
   console.log('Bike origin model',model);
   const handle=await page.evaluate(({model,p})=>(window as any).__game.missionForProfiling().vehicles.create(model,{x:p.x+6,y:-p.z+12,z:-100},0),{model,p:origin});await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),handle,{timeout:60000});
   await page.evaluate(h=>{const g=(window as any).__game;g.missionForProfiling().runtime.world.warpPedIntoCar(1,h);g.render().cameraSettings.vehicle='bumper';g.__originBike=g.missionForProfiling().vehicles.entity(h);},handle);
   await page.waitForFunction(()=>{const g=(window as any).__game;return !g.state().terrainHold&&g.__originBike.body.translation().y>-50&&g.render().nativeCharacter?.inVehiclePose;},undefined,{timeout:60000});
   await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.freezeVehiclePosition(h,true),handle);
   for(const [index,angles] of [[0,0,.6],[.45,.3,.6],[-.4,-.3,-.7]].entries()){
    await page.evaluate(({index,angles})=>{const g=(window as any).__game,b=g.__originBike,[pitch,roll,lean]=angles,q=b.root.quaternion.clone().setFromAxisAngle(b.root.position.clone().set(1,0,0),pitch).multiply(b.root.quaternion.clone().setFromAxisAngle(b.root.position.clone().set(0,0,1),roll));b.body.setRotation(q,true);b.lean=b.quad?0:lean;g.__originStage='frozen-'+index;g.__originRows=[];},{index,angles});
    await page.waitForFunction(()=>(window as any).__game.__originRows.length>=6,undefined,{timeout:20000});rows.push(...await page.evaluate(()=>(window as any).__game.__originRows.slice(-4)));if(index===1)await page.screenshot({path:`artifacts/bike-bumper-origin-${model}.png`});
   }
   if(model===461){
    await page.evaluate(h=>{const g=(window as any).__game;g.missionForProfiling().runtime.world.freezeVehiclePosition(h,false);g.__originStage='moving';g.__originRows=[];},handle);
    await page.keyboard.down('KeyW');try{await page.waitForFunction(()=>(window as any).__game.__originRows.filter((r:any)=>Math.hypot(r.physicalPosition.x-r.previous.x,r.physicalPosition.z-r.previous.z)>.001&&!r.query?.blocked).length>=5,undefined,{timeout:20000});rows.push(...await page.evaluate(()=>(window as any).__game.__originRows.filter((r:any)=>Math.hypot(r.physicalPosition.x-r.previous.x,r.physicalPosition.z-r.previous.z)>.001&&!r.query?.blocked).slice(-5)));}finally{await page.keyboard.up('KeyW');}
   }
   await page.evaluate(({h,p})=>{const g=(window as any).__game,w=g.missionForProfiling().runtime.world;g.__originBike=undefined;w.warpPedFromCarToCoord(1,p.x,-p.z,p.y+1);w.deleteVehicle(h);},{h:handle,p:origin});
  }
 }finally{await page.keyboard.up('KeyW');await page.evaluate(()=>(window as any).__game.__restoreOrigin?.());writeFileSync('artifacts/bike-bumper-origin-live.json',JSON.stringify({rows,errors},null,2));}
 expect(rows).toHaveLength(53);for(const row of rows)expect(row.horizontalError,JSON.stringify(row)).toBeLessThan(.0002);expect(rows.filter(r=>r.stage==='moving')).toHaveLength(5);expect(errors).toEqual([]);
});
