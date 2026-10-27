import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('real bumper look keys turn cars, bikes and boats aside and behind, then restore forward view',async({page})=>{
 test.setTimeout(360000);mkdirSync('artifacts',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 const origin=await page.evaluate(()=>({...((window as any).__game.sim.player.position)}));
 await page.evaluate(async()=>{
  const path='/src/simulation/recordingBody.ts',{nativeMatrixOf}=await import(path),g=(window as any).__game,r=g.render(),original=r.update;
  g.__bumperLookRows=[];
  r.update=function(this:any,...args:any[]){
   const b=this.bumper,vehicle=g.__bumperLookVehicle;let normal=b&&{...b.source};
   if(b?.sourceForCamera){const source=b.sourceForCamera;b.sourceForCamera=()=>{const out=source();normal={...out};return out;};}
   if(b?.viewForCamera){const view=b.viewForCamera;b.viewForCamera=(look:any,source:any)=>{normal={...source};return view(look,source);};}
   const result=original.apply(this,args);
   if(vehicle&&this.bumperView&&normal){
    const body=vehicle.body??vehicle.car.body,matrix=nativeMatrixOf(body.rotation(),body.translation()),direction=this.camera.getWorldDirection(this.camera.position.clone()),up=this.camera.up.clone().applyQuaternion(this.camera.quaternion),neck=this.nativeCharacter?.bonePosition(4,this.camera.position.clone()),boat=!!g.fleet().occupiedBoat,bike=!!g.fleet().occupiedBike&&!vehicle.quad,look=this.glance;
    const row={model:vehicle.modelId,look,camera:this.camera.position.toArray(),direction:[direction.x,-direction.z,direction.y],up:[up.x,-up.z,up.y],near:this.camera.near,fov:this.fov};
    const front=(look==='left'?matrix.right.map((x:number)=>-x):look==='right'?matrix.right:look==='behind'?matrix.forward.map((x:number)=>-x):nativeMatrixOf(b.quaternion,b.source).forward),length=Math.hypot(...front);
    g.__bumperLookRows.push({...row,directionDot:row.direction.reduce((sum:number,x:number,i:number)=>sum+x*front[i]/length,0),nativeInput:look==='none'?undefined:{vehicleType:boat?5:bike?9:0,appearance:boat?4:bike?2:1,behind:look==='behind',right:look==='right',driver:!!this.nativeCharacter?.inVehiclePose,neck:neck?[neck.x,-neck.z,neck.y]:[0,0,0],source:[normal.x,-normal.z,normal.y],front:matrix.forward,up:matrix.up,matrix}});
   }
   return result;
  };
  g.__restoreBumperLook=()=>{r.update=original;};
 });
 const rows:any[]=[],returns:any[]=[];
 try{
  for(const model of [492,471,586,481,446,453]){
   let handle:number|undefined;
   if(model===446||model===453)await page.evaluate(async model=>{const g=(window as any).__game;g.placePlayer(2600,3,2600);const b=await g.fleet().spawnBoat(model,2600,2601,0);b.finishEnter();g.__bumperLookVehicle=b;},model);
   else{handle=await page.evaluate(({model,p})=>(window as any).__game.missionForProfiling().vehicles.create(model,{x:p.x+6,y:-p.z+12,z:-100},55),{model,p:origin});await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),handle,{timeout:60000});await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.warpPedIntoCar(1,h);g.__bumperLookVehicle=m.vehicles.entity(h);},handle);}
   await page.evaluate(()=>(window as any).__game.render().cameraSettings.vehicle='bumper');
   await page.waitForFunction(()=>{const g=(window as any).__game;return !g.state().terrainHold&&g.render().nativeCharacter?.inVehiclePose&&g.render().bumperView;},undefined,{timeout:60000});
   for(const look of ['left','right','behind']){
    await page.evaluate(()=>(window as any).__game.__bumperLookRows=[]);
    try{if(look!=='right')await page.keyboard.down('KeyQ');if(look!=='left')await page.keyboard.down('KeyE');await page.waitForFunction(look=>(window as any).__game.__bumperLookRows.filter((r:any)=>r.look===look).length>=3,look,{timeout:20000});rows.push(...await page.evaluate(()=>(window as any).__game.__bumperLookRows.slice(-3)));if(look==='left')await page.screenshot({path:`artifacts/vehicle-bumper-look-${model}.png`});}
    finally{await page.keyboard.up('KeyQ');await page.keyboard.up('KeyE');}
    await page.waitForFunction(()=>(window as any).__game.render().glance==='none',undefined,{timeout:20000});
   }
   returns.push(await page.evaluate(()=>(window as any).__game.__bumperLookRows.at(-1)));
   await page.evaluate(({h,p})=>{const g=(window as any).__game;g.__bumperLookVehicle=undefined;if(h===undefined){const b=g.fleet().occupiedBoat;b.finishExit({x:2605,y:3,z:2605});g.fleet().removeScriptVehicle(b);}else{const w=g.missionForProfiling().runtime.world;w.warpPedFromCarToCoord(1,p.x,-p.z,p.y+1);w.deleteVehicle(h);}},{h:handle,p:origin});
  }
 }finally{await page.evaluate(()=>(window as any).__game.__restoreBumperLook?.());writeFileSync('artifacts/vehicle-bumper-look-live.json',JSON.stringify({rows,returns,errors},null,2));}
 expect(rows).toHaveLength(54);for(const row of rows){expect(row.directionDot,JSON.stringify(row)).toBeGreaterThan(.99999);expect(row.near).toBeCloseTo(.05,7);expect(row.fov).toBe(60);}for(const row of returns){expect(row.look).toBe('none');expect(row.directionDot).toBeGreaterThan(.99999);expect(row.near).toBe(.08);}expect(errors).toEqual([]);
});
