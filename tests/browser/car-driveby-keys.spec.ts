import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('player car drive-bys pose and fire from the selected side with one visible gun',async({page})=>{
 test.setTimeout(300000);mkdirSync('artifacts',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 await page.evaluate(async()=>{
  const [entry,driving,carDriving,view,weapon,recording,data,door,groups]=await Promise.all(['/src/simulation/CarEntry.ts','/src/simulation/nativeDrivingAnims.ts','/src/simulation/nativeCarDriving.ts','/src/weapons/WeaponView.ts','/src/weapons/WeaponSystem.ts','/src/simulation/recordingBody.ts','/src/weapons/weaponData.ts','/src/simulation/nativeDoor.ts','/src/assets/vehicleAnimGroups.ts'].map(p=>import(p))),g=(window as any).__game,inventory=g.weapons().inventory;
  const {CarEntry}=entry,{NativeDrivingAnims}=driving,{CAR_DRIVING_CLIPS,carDrivingClipId,carDrivingAssociationFlags}=carDriving,{WeaponView}=view,{WeaponSystem}=weapon,{nativeMatrixOf}=recording,{nativeWeaponInfo}=data;
  const rideOriginal=CarEntry.prototype.rideAnims,stepOriginal=NativeDrivingAnims.prototype.step,viewOriginal=WeaponView.prototype.update,fireOriginal=WeaponSystem.prototype.fireDriveby,tickOriginal=inventory.tick,carFireOriginal=inventory.fireFromCar;
  g.__carPoseRows=[];g.__carRays=[];
  const weaponState=()=>inventory.driveByState&&structuredClone(inventory.driveByState.weapon);
  const finish=()=>{const row=g.__carPending;if(row){row.actualWeapon=weaponState();g.__carPending=undefined;}};
  CarEntry.prototype.rideAnims=function(this:any){const out=rideOriginal.call(this),c=this.car,v=c?.car.body.linvel();if(c&&v){g.__carEntity=c;g.__carRide={low:!!(c.modelFlags&door.MODEL_FLAG.low),kart:!!(c.animGroup.special&groups.VEHICLE_ANIM_SPECIAL.kart),truck:!!(c.animGroup.special&groups.VEHICLE_ANIM_SPECIAL.truckDrive),drivingSkill:this.drivingSkill,velocity:[v.x/50,-v.z/50,v.y/50],gas:c.gasPedal,rideIds:[out.idle,out.left,out.right,out.back].map(carDrivingClipId)};}return out;};
  NativeDrivingAnims.prototype.step=function(this:any,dt:number,input:any){
   const active=input.driveByControl,ride=g.__carRide,initial=this.associations.map(({group,...a}:any)=>a),before=weaponState(),durations=Object.fromEntries(Object.entries(CAR_DRIVING_CLIPS).map(([id,name])=>[id,input.duration(name)])),result=stepOriginal.call(this,dt,input);
   if(active&&ride){const idle=ride.rideIds[0],nativeInput={...ride,rideIds:undefined,steer:input.steer,fire:active.fire,left:active.left,right:active.right,ammo:active.ammo,allowed:active.enabled,dt,associations:[...initial,{identifier:idle,amount:input.idleFull?1:0,delta:0,time:0,duration:durations[idle],flags:carDrivingAssociationFlags(idle)|1}],durations,withDriveBy:true,nativeWeapon:!!before,state:before?.state??0,clip:before?.clip??50,nextShot:before?.nextShot??0,timeMs:inventory.driveByState?.timeMs??100,magazine:nativeWeaponInfo(inventory.native,inventory.selected,1).clip,reloadMs:1000,progress:inventory.fullCompletion()?100:0,infinite:false,entityByte:2};const row={model:g.__carEntity.modelId,nativeInput,rideIds:ride.rideIds,shotReady:this.driveByShotReady,actualFired:false,frame:this.associations.map(({identifier,amount,delta,time,speed,timeStep,flags}:any)=>({identifier,amount,delta,time,speed,timeStep,flags}))};g.__carPoseRows.push(row);g.__carPending=row;g.__carPoseState={model:row.model,active:this.driveByActive,ready:this.driveByShotReady,frame:row.frame,low:active.low};}
   return result;
  };
  inventory.tick=function(this:any,...args:any[]){finish();return tickOriginal.apply(this,args);};
  inventory.fireFromCar=function(this:any){const result=carFireOriginal.call(this);if(g.__carPending)g.__carPending.actualFired=result;return result;};
  WeaponView.prototype.update=function(this:any){viewOriginal.call(this);g.__carWeapon={selected:this.selected,rightVisible:this.held?.root.visible,leftVisible:this.leftHeld?.root.visible,rightMounted:!!this.held&&this.held.root.parent===this.owner?.hand(24),error:this.error};};
  WeaponSystem.prototype.fireDriveby=function(this:any,car:any,camera:any,look:any){
   const originalPose=this.vehicleFirePose,originalDraw=this.driveByRandom,originalQuery=this.driveByAimQuery,originalFire=this.fireInstantHit,body=nativeMatrixOf(car.car.body.rotation(),car.car.body.translation()),v={...car.car.body.linvel()},info=this.inventory.native&&nativeWeaponInfo(this.inventory.native,this.inventory.selected,1),timeStep=Math.fround(this.planeGunStepSeconds*50),draws:number[]=[];let pose:any,query:any,ray:any;
   this.vehicleFirePose=()=>{const value=originalPose?.();pose=value&&structuredClone(value);return value;};this.driveByRandom=()=>{const value=originalDraw();draws.push(value);return value;};
   this.driveByAimQuery=function(this:any,start:any,end:any,own:any){const peds=originalQuery.call(this,start,end,own);query={start:[...start],end:[...end],peds:structuredClone(peds)};return peds;};
   this.fireInstantHit=function(this:any,...args:any[]){if(args[6]===false)ray={from:{...args[2]},direction:{...args[3]},range:args[5],spread:args[6]};return originalFire.apply(this,args);};
   try{const result=fireOriginal.call(this,car,camera,look);if(pose&&query&&ray&&info)g.__carRays.push({model:car.modelId,look,shotReady:g.__carPoseState.ready,seedInput:{vehicleMatrix:[body.right,body.forward,body.up,body.position],handMatrix:pose.handMatrix,velocity:[v.x/50,-v.z/50,v.y/50],fireOffset:info.fireOffset,range:info.weaponRange,timeStep,left:look==='left',right:look==='right',vehicleType:0,random:draws},actualSeed:{start:query.start,end:query.end},aimInput:{start:query.start,end:query.end,owner:pose.owner,vehicle:body.position,subtype:0,model:car.modelId,hasOwner:true,aimVehicles:false,peds:query.peds,vehicles:[]},ray});return result;
   }finally{this.vehicleFirePose=originalPose;this.driveByRandom=originalDraw;this.driveByAimQuery=originalQuery;this.fireInstantHit=originalFire;}
  };
  g.__carRestore=()=>{finish();CarEntry.prototype.rideAnims=rideOriginal;NativeDrivingAnims.prototype.step=stepOriginal;WeaponView.prototype.update=viewOriginal;WeaponSystem.prototype.fireDriveby=fireOriginal;inventory.tick=tickOriginal;inventory.fireFromCar=carFireOriginal;};
  inventory.give(28,5000);inventory.select(28);
 });
 const origin=await page.evaluate(()=>({...((window as any).__game.sim.player.position)})),models:any[]=[];
 const ammo=()=>page.evaluate(()=>{const a=(window as any).__game.weapons().inventory.ammo.get(28);return a.clip+a.reserve;});
 const gameWait=async(ms:number)=>{const start=await page.evaluate(()=>(window as any).__game.weapons().nowMs);await page.waitForFunction(({start,ms})=>(window as any).__game.weapons().nowMs-start>=ms,{start,ms},{timeout:30000});};
 const pose=()=>page.evaluate(()=>{const g=(window as any).__game;return {state:g.__carPoseState,weapon:g.__carWeapon,pose:g.render().vehiclePose?.pose,visible:g.render().nativeCharacter.root.visible};});
 try{
  for(const id of [492,534,403,571]){
   const handle=await page.evaluate(({id,p})=>(window as any).__game.missionForProfiling().vehicles.create(id,{x:p.x+6,y:-p.z+12,z:-100},90),{id,p:origin});
   await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),handle,{timeout:60000});await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,h),handle);
   await page.waitForFunction(id=>{const g=(window as any).__game;return g.weapons().ready&&g.__carPoseState?.model===id&&g.render().nativeCharacter.hasVehicleClip('driveby_l');},id,{timeout:60000});
   const before=await ammo();await page.keyboard.down('ControlRight');await gameWait(300);expect(await ammo()).toBe(before);await page.keyboard.up('ControlRight');
   await page.keyboard.down('KeyQ');await page.waitForFunction(()=>{const g=(window as any).__game,id=g.__carPoseState.low?76:74;return g.__carPoseState.frame.some((a:any)=>a.identifier===id&&a.amount>.99&&!(a.flags&1))&&g.__carWeapon?.rightVisible;},undefined,{timeout:15000});expect(await ammo()).toBe(before);const lookOnly=await pose();
   await page.keyboard.down('ControlRight');await page.waitForFunction(id=>(window as any).__game.__carRays.some((r:any)=>r.model===id&&r.look==='left'),id,{timeout:15000});const left=await pose();await page.screenshot({path:`artifacts/car-driveby-left-${id}.png`});
   await page.keyboard.up('KeyQ');await page.keyboard.down('KeyE');await page.waitForFunction(id=>(window as any).__game.__carRays.some((r:any)=>r.model===id&&r.look==='right'),id,{timeout:15000});const right=await pose();
   await page.keyboard.up('KeyE');const after=await ammo();await gameWait(400);expect(await ammo()).toBe(after);await page.waitForFunction(()=>!(window as any).__game.__carPoseState.active&&!(window as any).__game.__carWeapon.rightVisible,undefined,{timeout:15000});await page.keyboard.up('ControlRight');models.push({id,before,after,lookOnly,left,right});
   await page.evaluate(({h,p})=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.warpPedFromCarToCoord(1,p.x,-p.z,p.y+1);m.runtime.world.deleteVehicle(h);},{h:handle,p:origin});
   await page.waitForFunction(()=>(window as any).__game.state().carEntry.phase===null,undefined,{timeout:15000});
  }
 }finally{
  for(const key of ['ControlRight','KeyQ','KeyE'])await page.keyboard.up(key);
  const result=await page.evaluate(()=>{const g=(window as any).__game;g.__carRestore?.();return {rows:g.__carPoseRows??[],rays:g.__carRays??[]};});writeFileSync('artifacts/car-driveby-live.json',JSON.stringify({models,errors,...result},null,2));
 }
 const result=await page.evaluate(()=>({rays:(window as any).__game.__carRays,rows:(window as any).__game.__carPoseRows}));
 expect(models).toHaveLength(4);for(const m of models){expect(m.after).toBeLessThan(m.before);for(const p of [m.lookOnly,m.left,m.right]){expect(p.visible).toBe(true);expect(p.weapon.rightVisible).toBe(true);expect(p.weapon.leftVisible).not.toBe(true);expect(p.weapon.rightMounted).toBe(true);expect(p.weapon.error).toBeUndefined();}}
 for(const id of [492,534,403,571])for(const look of ['left','right'])expect(result.rays.some((r:any)=>r.model===id&&r.look===look&&r.shotReady)).toBe(true);expect(errors).toEqual([]);
});
