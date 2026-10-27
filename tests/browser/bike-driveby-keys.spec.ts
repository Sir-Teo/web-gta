import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('real bike fire and look keys pose the rider with one visible SMG and return to riding on release',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 await page.evaluate(async()=>{
  const path='/src/weapons/WeaponView.ts',{WeaponView}=await import(path),g=(window as any).__game;
  const [{WeaponSystem},{nativeMatrixOf},{nativeWeaponInfo}]=await Promise.all(['/src/weapons/WeaponSystem.ts','/src/simulation/recordingBody.ts','/src/weapons/weaponData.ts'].map(p=>import(p)));
  g.__bikeRayOriginal=WeaponSystem.prototype.fireDrivebyBike;g.__bikeRayRows=[];
  WeaponSystem.prototype.fireDrivebyBike=function(this:any,bike:any,camera:any,look:any){
   const originalPose=this.bikeFirePose,originalDraw=this.driveByRandom,originalQuery=this.driveByAimQuery,originalFire=this.fireInstantHit,body=nativeMatrixOf(bike.body.rotation(),bike.body.translation()),v={...bike.body.linvel()},info=this.inventory.native&&nativeWeaponInfo(this.inventory.native,this.inventory.selected,1),timeStep=Math.fround(this.planeGunStepSeconds*50),draws:number[]=[];
   let pose:any,query:any,ray:any;
   this.bikeFirePose=()=>{const value=originalPose?.();pose=value&&structuredClone(value);return value;};this.driveByRandom=()=>{const value=originalDraw();draws.push(value);return value;};
   this.driveByAimQuery=function(this:any,start:any,end:any,own:any){const peds=originalQuery.call(this,start,end,own);query={start:[...start],end:[...end],peds:structuredClone(peds)};return peds;};
   this.fireInstantHit=function(this:any,...args:any[]){if(args[6]===false)ray={from:{...args[2]},direction:{...args[3]},range:args[5],spread:args[6]};return originalFire.apply(this,args);};
   try{const result=g.__bikeRayOriginal.call(this,bike,camera,look);
    if(pose&&query&&ray&&info)g.__bikeRayRows.push({model:bike.modelId,seedInput:{vehicleMatrix:[body.right,body.forward,body.up,body.position],handMatrix:pose.handMatrix,velocity:[v.x/50,-v.z/50,v.y/50],fireOffset:info.fireOffset,range:info.weaponRange,timeStep,left:look==='left',right:look==='right',vehicleType:bike.quad?0:9,random:draws},actualSeed:{start:query.start,end:query.end},aimInput:{start:query.start,end:query.end,owner:pose.owner,vehicle:body.position,subtype:bike.quad?2:[481,509,510].includes(bike.modelId)?10:9,model:bike.modelId,hasOwner:true,aimVehicles:false,peds:query.peds,vehicles:[]},ray});return result;
   }finally{this.bikeFirePose=originalPose;this.driveByRandom=originalDraw;this.driveByAimQuery=originalQuery;this.fireInstantHit=originalFire;}
  };
  g.__bikeDriveByOriginal=WeaponView.prototype.update;
  WeaponView.prototype.update=function(this:any){g.__bikeDriveByOriginal.call(this);g.__bikeDriveByWeapon={selected:this.selected,rightVisible:this.held?.root.visible,leftVisible:this.leftHeld?.root.visible,rightMounted:!!this.held&&this.held.root.parent===this.owner?.hand(24),error:this.error};};
  g.weapons().inventory.give(28,500);g.weapons().inventory.select(28);
 });
 let rays:any[]=[];
 const origin=await page.evaluate(()=>({...((window as any).__game.sim.player.position)})),models:any[]=[];
 try{
  for(const id of [461,481,471]){
   const handle=await page.evaluate(({id,origin:p})=>{const g=(window as any).__game;return g.missionForProfiling().vehicles.create(id,{x:p.x+6,y:-p.z+12,z:-100},90);},{id,origin});
   await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),handle,{timeout:60000});await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,h),handle);
   await page.waitForFunction(()=>(window as any).__game.weapons().ready&&(window as any).__game.__bikeDriveByWeapon?.selected===28,undefined,{timeout:45000});
   const target=await page.evaluate(async()=>{const path='/src/simulation/recordingBody.ts',{nativeMatrixOf}=await import(path),g=(window as any).__game,b=g.fleet().occupiedBike,m=nativeMatrixOf(b.body.rotation(),b.body.translation());return g.missionForProfiling().peds.create(4,'MALE01',{x:m.position[0]+m.forward[0]*5+m.right[0]*.6,y:m.position[1]+m.forward[1]*5+m.right[1]*.6,z:-100});});
   await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h)?.body?.isEnabled(),target,{timeout:45000});
   await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling(),p=m.peds.entity(h);p.proofs={...p.proofs,bullet:true};m.runtime.world.givePedScriptedTask(h,{kind:'standStill',time:60000},0x05ba);},target);
   const ammoBefore=await page.evaluate(()=>{const a=(window as any).__game.weapons().inventory.ammo.get(28);return a.clip+a.reserve;});
   await page.keyboard.down('ControlRight');
   const waitPose=async(side:string)=>{await page.waitForFunction(side=>{const g=(window as any).__game;return g.fleet().occupiedBike?.riderDriveByActive&&g.render().vehiclePose?.pose.partials?.some((a:any)=>a.clip.includes('driveby')&&a.clip.endsWith(side)&&a.amount>.95)&&g.__bikeDriveByWeapon?.rightVisible===true;},side,{timeout:15000});return page.evaluate(()=>{const g=(window as any).__game,b=g.fleet().occupiedBike;return {pose:g.render().vehiclePose.pose,weapon:g.__bikeDriveByWeapon,visible:g.render().nativeCharacter.root.visible,mode:b.bicycleRider?.decision?.mode,hop:!!b.hopState?.animation};});};
   const forward=await waitPose('ft');await page.keyboard.down('KeyQ');const left=await waitPose('lhs');await page.screenshot({path:`artifacts/bike-driveby-keys-${id}.png`});
   await page.keyboard.up('KeyQ');await page.keyboard.down('KeyE');const right=await waitPose('rhs');await page.keyboard.up('KeyE');await page.keyboard.up('ControlRight');
   await page.waitForFunction(()=>{const g=(window as any).__game;return !g.fleet().occupiedBike?.riderDriveByActive&&g.__bikeDriveByWeapon?.rightVisible===false;},undefined,{timeout:15000});
   const ammoAfter=await page.evaluate(()=>{const a=(window as any).__game.weapons().inventory.ammo.get(28);return a.clip+a.reserve;});models.push({id,forward,left,right,ammoBefore,ammoAfter});
   await page.evaluate(h=>{const g=(window as any).__game,b=g.fleet().occupiedBike;b.finishExit();g.missionForProfiling().runtime.world.deleteVehicle(h);},handle);
   await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deletePed(h),target);
   await page.waitForFunction(()=>!(window as any).__game.fleet().occupiedBike);
  }
 }finally{
  await page.keyboard.up('ControlRight');await page.keyboard.up('KeyQ');await page.keyboard.up('KeyE');
  await page.evaluate(async()=>{const [{WeaponView},{WeaponSystem}]=await Promise.all(['/src/weapons/WeaponView.ts','/src/weapons/WeaponSystem.ts'].map(p=>import(p))),g=(window as any).__game;if(g.__bikeDriveByOriginal)WeaponView.prototype.update=g.__bikeDriveByOriginal;if(g.__bikeRayOriginal)WeaponSystem.prototype.fireDrivebyBike=g.__bikeRayOriginal;});
  rays=await page.evaluate(()=>(window as any).__game.__bikeRayRows??[]);writeFileSync('artifacts/bike-driveby-keys-live.json',JSON.stringify({models,errors,rays},null,2));
 }
 for(const m of models){expect(m.ammoAfter).toBeLessThan(m.ammoBefore);for(const p of [m.forward,m.left,m.right]){expect(p.visible).toBe(true);expect(p.weapon.rightMounted).toBe(true);expect(p.weapon.rightVisible).toBe(true);expect(p.weapon.leftVisible).not.toBe(true);expect(p.weapon.error).toBeUndefined();if(m.id===481){expect(p.mode).toBe('ride');expect(p.hop).toBe(false);}}}
 expect(rays.length).toBeGreaterThan(8);for(const id of [461,481,471])expect(rays.some(r=>r.model===id)).toBe(true);for(const ray of rays){expect(ray.seedInput.random).toHaveLength(3);expect(ray.ray.spread).toBe(false);}
 expect(rays.some(r=>{const end=r.ray.direction,p=r.ray.from,free=r.actualSeed.end;return Math.hypot(p.x+end.x*r.ray.range-free[0],p.y+end.y*r.ray.range-free[2],p.z+end.z*r.ray.range+free[1])>.01;})).toBe(true);
 expect(models).toHaveLength(3);expect(errors).toEqual([]);
});
