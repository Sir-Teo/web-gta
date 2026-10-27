import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('passengers can select bumper view, hide seated bodies and use the bike driver neck',async({page})=>{
 test.setTimeout(300000);mkdirSync('artifacts',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 const origin=await page.evaluate(()=>({...((window as any).__game.sim.player.position)}));
 await page.evaluate(async()=>{
  const dep='/src/render/NativeCharacter.ts',matrixDep='/src/simulation/recordingBody.ts',{NativeCharacter}=await import(dep),{nativeMatrixOf}=await import(matrixDep),g=(window as any).__game,r=g.render(),update=r.update,draw=r.renderer.render,pose=NativeCharacter.prototype.updateVehicle,bone=NativeCharacter.prototype.bonePosition,views=new Map<any,any>();let drawn:any,previousTick=g.state().tick;
  g.__passengerCameraRows=[];
  NativeCharacter.prototype.updateVehicle=function(this:any,frame:any,...args:any[]){views.set(this,frame.vehicle);return pose.call(this,frame,...args);};
  r.renderer.render=function(this:any,scene:any,camera:any){const v=g.__passengerCameraVehicle;if(v&&scene===r.scene&&camera===r.camera)drawn={vehicle:v.car.root.visible,player:r.nativeCharacter.root.visible,others:[...views].filter(([view,root])=>root===v.car.root&&view!==r.nativeCharacter).map(([view])=>view.root.visible)};return draw.call(this,scene,camera);};
  r.update=function(this:any,...args:any[]){
   const tick=g.state().tick,cameraStep=Math.fround(Math.min(3,(tick-previousTick)*50/60));previousTick=tick;const v=g.__passengerCameraVehicle,b=this.bumper,base=b&&{...b.source},front=this.camera.getWorldDirection(this.camera.position.clone()),up=this.camera.up.clone().applyQuaternion(this.camera.quaternion);let neck:any,query:any,normal:any;drawn=undefined;
   if(b?.sourceForCamera){const source=b.sourceForCamera;b.sourceForCamera=()=>{
    const world=g.sim.world,cast=world.castRay;
    world.castRay=function(this:any,...args:any[]){const result=cast.apply(this,args);query={blocked:result!==null};return result;};
    NativeCharacter.prototype.bonePosition=function(this:any,id:number,...args:any[]){const out=bone.call(this,id,...args);if(id===4&&out)neck={point:{x:out.x,y:out.y,z:out.z},player:this===r.nativeCharacter};return out;};
    try{normal=source();return normal;}finally{world.castRay=cast;NativeCharacter.prototype.bonePosition=bone;}
   };}
   const result=update.apply(this,args);
   if(v&&drawn){const seat=typeof v.riderPose==='function'?v.seat():v.car.nativeFramePosition('ped_frontseat'),matrix=nativeMatrixOf(v.car.root.quaternion,v.car.root.position),position=v.car.body.translation(),velocity=v.car.body.linvel();g.__passengerCameraRows.push({sourceInput:{boat:false,vehicleType:typeof v.riderPose==='function'&&!v.quad?9:0,position:typeof v.riderPose==='function'?[v.renderBodyPosition.x,-v.renderBodyPosition.z,v.renderBodyPosition.y]:matrix.position,dummy:[seat.x,seat.y,seat.z],matrix},nativeInput:neck?{vehicleType:9,matrix,dummy:[seat.x,seat.y,seat.z],declaredSource:[base.x,-base.z,base.y],vehiclePosition:[position.x,-position.z,position.y],neck:[neck.point.x,-neck.point.z,neck.point.y],velocity:[velocity.x/50,-velocity.z/50,velocity.y/50],timeStep:cameraStep,front:[front.x,-front.z,front.y],up:[up.x,-up.z,up.y],lineClear:!query?.blocked}:undefined,stage:g.__passengerCameraStage,model:v.modelId,mode:this.cameraSettings.vehicle,bumper:this.bumperView,look:this.glance,camera:this.camera.position.toArray(),normal,neck,query,draw:drawn,after:{vehicle:v.car.root.visible,player:this.nativeCharacter.root.visible},fov:this.fov,near:this.camera.near});}return result;
  };
  g.__restorePassengerCamera=()=>{r.update=update;r.renderer.render=draw;NativeCharacter.prototype.updateVehicle=pose;NativeCharacter.prototype.bonePosition=bone;};
 });
 const rows:any[]=[];
 try{
  for(const scenario of [{model:492,seat:0,driver:true},{model:492,seat:1,driver:true},{model:492,seat:2,driver:true},{model:471,seat:0,driver:true},{model:586,seat:0,driver:true},{model:586,seat:0,driver:false}]){
   const handle=await page.evaluate(({model,p})=>(window as any).__game.missionForProfiling().vehicles.create(model,{x:p.x+6,y:-p.z+12,z:-100},0),{model:scenario.model,p:origin});
   await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),handle,{timeout:60000});
   let driver:number|undefined;
   if(scenario.driver){driver=await page.evaluate(p=>(window as any).__game.missionForProfiling().peds.create(4,'MALE01',{x:p.x+4,y:-p.z+8,z:-100}),origin);await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),driver,{timeout:60000});await page.evaluate(({driver,handle})=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(driver,handle),{driver,handle});}
   const prefix=`${scenario.model}-${scenario.seat}-${scenario.driver}`;console.log('Passenger camera scenario',prefix);
   await page.evaluate(({handle,seat,prefix})=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.warpPedIntoCarAsPassenger(1,handle,seat);m.runtime.world.freezeVehiclePosition(handle,true);const v=m.vehicles.entity(handle);v.car.body.setLinvel({x:0,y:0,z:0},true);g.__passengerCameraVehicle=v;g.__passengerCameraStage=prefix+'-near';g.__passengerCameraRows=[];g.render().cameraSettings.vehicle='near';},{handle,seat:scenario.seat,prefix});
   await page.waitForFunction(({prefix,driver})=>{const g=(window as any).__game;return !g.state().terrainHold&&g.render().nativeCharacter?.inVehiclePose&&g.__passengerCameraRows.filter((r:any)=>r.stage===prefix+'-near'&&(!driver||r.draw.others.length>0)).length>=2;},{prefix,driver:scenario.driver},{timeout:60000});
   rows.push(...await page.evaluate(()=>(window as any).__game.__passengerCameraRows.slice(-2)));
   for(let i=0;i<4;i++){const previous=await page.evaluate(()=>(window as any).__game.render().cameraSettings.vehicle);if(previous==='bumper')break;await page.keyboard.press('KeyV');await page.waitForFunction(previous=>(window as any).__game.render().cameraSettings.vehicle!==previous,previous,{timeout:10000});}
   for(const look of ['none','left','right','behind']){
    await page.evaluate(stage=>{const g=(window as any).__game;g.__passengerCameraStage=stage;g.__passengerCameraRows=[];},`${prefix}-${look}`);
    try{if(look==='left'||look==='behind')await page.keyboard.down('KeyQ');if(look==='right'||look==='behind')await page.keyboard.down('KeyE');await page.waitForFunction(look=>(window as any).__game.__passengerCameraRows.filter((r:any)=>r.look===look).length>=3,look,{timeout:20000});rows.push(...await page.evaluate(()=>(window as any).__game.__passengerCameraRows.slice(-3)));}
    finally{await page.keyboard.up('KeyQ');await page.keyboard.up('KeyE');}
   }
   await page.evaluate(({handle,driver,p})=>{const g=(window as any).__game,w=g.missionForProfiling().runtime.world;g.__passengerCameraVehicle=undefined;w.warpPedFromCarToCoord(1,p.x,-p.z,p.y+1);if(driver!==undefined)w.deletePed(driver);w.deleteVehicle(handle);},{handle,driver,p:origin});
  }
 }finally{await page.keyboard.up('KeyQ');await page.keyboard.up('KeyE');await page.evaluate(()=>(window as any).__game.__restorePassengerCamera?.());writeFileSync('artifacts/passenger-bumper-camera-live.json',JSON.stringify({rows,errors},null,2));}
 expect(rows).toHaveLength(84);for(const row of rows){const bumper=row.mode==='bumper',hidden=bumper&&row.look==='none';expect(row.bumper,JSON.stringify(row)).toBe(bumper);expect(row.draw.vehicle).toBe(!hidden);expect(row.draw.player).toBe(!hidden);expect(row.draw.others.every((v:boolean)=>v===!hidden)).toBe(true);expect(row.after).toEqual({vehicle:true,player:true});if(bumper){expect(row.fov).toBe(60);expect(row.near).toBeCloseTo(row.look==='none'?.08:.05,7);}}
 const withDriver=rows.filter(r=>r.stage==='586-0-true-none'),withoutDriver=rows.filter(r=>r.stage==='586-0-false-none');expect(withDriver).toHaveLength(3);for(const row of withDriver){expect(row.neck?.player).toBe(false);expect(row.normal.y).toBe(Math.fround((row.query?.blocked?Math.fround(Math.fround(row.neck.point.y)+Math.fround(.62)):Math.fround(row.neck.point.y))+Math.fround(.15)));}for(const row of withoutDriver)expect(row.neck).toBeUndefined();expect(errors).toEqual([]);
});
