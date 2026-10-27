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
  g.__bikeBumperRows=[];let previousTick=g.state().tick;
  r.update=function(this:any,...args:any[]){
   const b=g.fleet().occupiedBike,tick=g.state().tick,timeStep=Math.fround(Math.min(3,(tick-previousTick)*50/60));previousTick=tick;
   const bumper=this.bumper,base=bumper&&{...bumper.source},front=this.camera.getWorldDirection(this.camera.position.clone()),up=this.camera.up.clone().applyQuaternion(this.camera.quaternion);let nativeInput:any,query:any,neckSample:any;
   if(bumper?.sourceForCamera&&b){
    const source=bumper.sourceForCamera;
    bumper.sourceForCamera=()=>{
     const world=g.sim.world,cast=world.castRay,character=this.nativeCharacter,bone=character.bonePosition;
     world.castRay=function(this:any,ray:any,length:number,...rest:any[]){const result=cast.call(this,ray,length,...rest);query={from:{...ray.origin},to:{x:ray.origin.x+ray.dir.x*length,y:ray.origin.y+ray.dir.y*length,z:ray.origin.z+ray.dir.z*length},blocked:result!==null};return result;};
     character.bonePosition=function(this:any,id:number,...rest:any[]){const out=bone.call(this,id,...rest);if(id===4&&out)neckSample={x:out.x,y:out.y,z:out.z};return out;};
     try{const out=source(),v=b.body.linvel(),p=b.body.translation(),seat=b.seat();if(neckSample)nativeInput={vehicleType:9,matrix:nativeMatrixOf(b.root.quaternion,b.root.position),dummy:[seat.x,seat.y,seat.z],declaredSource:[base.x,-base.z,base.y],vehiclePosition:[p.x,-p.z,p.y],neck:[neckSample.x,-neckSample.z,neckSample.y],velocity:[v.x/50,-v.z/50,v.y/50],timeStep,front:[front.x,-front.z,front.y],up:[up.x,-up.z,up.y],lineClear:!query?.blocked};return out;}
     finally{world.castRay=cast;character.bonePosition=bone;}
    };
   }
   const result=original.apply(this,args);
   if(b&&this.bumperView){
    const seat=b.seat(),expected=b.root.localToWorld(b.root.position.clone().set(0,seat.z+.62,-seat.y-.08)),camera=this.camera.position;
    if(query?.blocked){const p=b.body.translation();expected.x=p.x;expected.z=p.z;}
    g.__bikeBumperRows.push({model:b.modelId,quad:b.quad,nativeInput,query,neckSample,neckAfter:this.nativeCharacter?.bonePosition(4,this.camera.position.clone())?.toArray(),sourceInput:{boat:false,vehicleType:b.quad?0:9,position:[b.renderBodyPosition.x,-b.renderBodyPosition.z,b.renderBodyPosition.y],dummy:[seat.x,seat.y,seat.z],matrix:nativeMatrixOf(b.root.quaternion,b.root.position)},camera:camera.toArray(),expected:expected.toArray(),horizontalError:Math.hypot(camera.x-expected.x,camera.z-expected.z),error:camera.distanceTo(expected),fov:this.fov});
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
   if(id===461){
    await page.evaluate(h=>{const g=(window as any).__game,b=g.missionForProfiling().vehicles.entity(h),v=b.body.linvel();b.body.setLinvel({x:v.x,y:6,z:v.z},true);g.__bikeBumperRows=[];},handle);
    await page.keyboard.down('KeyW');const start=await page.evaluate(()=>(window as any).__game.gameTimeMs());
    try{await page.waitForFunction(start=>(window as any).__game.gameTimeMs()>start+300,start,{timeout:30000});rows.push(...await page.evaluate(()=>(window as any).__game.__bikeBumperRows.filter((r:any)=>Math.abs(r.nativeInput?.velocity[2]??0)>.01).slice(-10)));}finally{await page.keyboard.up('KeyW');}
    await page.evaluate(h=>{const g=(window as any).__game;g.missionForProfiling().runtime.world.freezeVehiclePosition(h,true);g.__bikeBumperRows=[];},handle);
    await page.waitForFunction(()=>(window as any).__game.__bikeBumperRows.length>=2,undefined,{timeout:10000});
    await page.evaluate(async()=>{const dep='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(dep),g=(window as any).__game,q=g.__bikeBumperRows.at(-1).query,at={x:q.from.x*.75+q.to.x*.25,y:q.from.y,z:q.from.z*.75+q.to.z*.25};g.__bikeCameraWall=g.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.08,2,.08).setTranslation(at.x,at.y,at.z));});
    try{await page.waitForFunction(()=>(window as any).__game.__bikeBumperRows.filter((r:any)=>r.nativeInput?.lineClear===false).length>=5,undefined,{timeout:20000});rows.push(...await page.evaluate(()=>(window as any).__game.__bikeBumperRows.filter((r:any)=>r.nativeInput?.lineClear===false).slice(-5)));}
    finally{await page.evaluate(h=>{const g=(window as any).__game;if(g.__bikeCameraWall)g.sim.world.removeCollider(g.__bikeCameraWall,true);g.missionForProfiling().runtime.world.freezeVehiclePosition(h,false);},handle);}
   }
   await page.evaluate(({h,p})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.warpPedFromCarToCoord(1,p.x,-p.z,p.y+1);w.deleteVehicle(h);},{h:handle,p:origin});
  }
 }finally{await page.evaluate(()=>(window as any).__game.__restoreBikeBumper?.());writeFileSync('artifacts/bike-bumper-camera-live.json',JSON.stringify({rows,errors},null,2));}
 expect(rows.length).toBeGreaterThanOrEqual(148);expect(rows.some(r=>r.nativeInput?.lineClear===false)).toBe(true);expect(rows.some(r=>Math.abs(r.nativeInput?.velocity[2]??0)>.01)).toBe(true);
 // Geometric doubles bound the seat location; native fixtures/replay check the float32 source arithmetic exactly.
 for(const row of rows){expect(row.quad?row.error:row.horizontalError,JSON.stringify(row)).toBeLessThan(.001);expect(row.fov).toBe(60);if(!row.quad){expect(row.nativeInput).toBeDefined();expect([row.neckSample.x,row.neckSample.y,row.neckSample.z]).toEqual(row.neckAfter);}}expect(errors).toEqual([]);
});
