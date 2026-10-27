import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('forward bumper draws cull the occupied vehicle and its seated bodies, then restore visibility',async({page})=>{
 test.setTimeout(240000);mkdirSync('artifacts',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 const origin=await page.evaluate(()=>({...((window as any).__game.sim.player.position)}));
 await page.evaluate(async()=>{
  const path='/src/render/NativeCharacter.ts',{NativeCharacter}=await import(path),g=(window as any).__game,r=g.render(),owners=new Map<any,any>(),pose=NativeCharacter.prototype.updateVehicle,foot=NativeCharacter.prototype.update,update=r.update,draw=r.renderer.render;let drawn:any;
  const visible=(vehicle:any)=>({vehicle:vehicle.visible,player:r.nativeCharacter.root.visible,occupants:[...owners].filter(([,owner])=>owner===vehicle).map(([root])=>({id:root.uuid,visible:root.visible}))});g.__cullingRows=[];
  NativeCharacter.prototype.updateVehicle=function(this:any,frame:any,...rest:any[]){if(frame.renderWithVehicle===false)owners.delete(this.root);else owners.set(this.root,frame.vehicle);return pose.call(this,frame,...rest);};
  NativeCharacter.prototype.update=function(this:any,...args:any[]){owners.delete(this.root);return foot.apply(this,args);};
  r.renderer.render=function(this:any,scene:any,camera:any){if(scene===r.scene&&camera===r.camera&&g.__cullingVehicle)drawn=visible(g.__cullingVehicle);return draw.call(this,scene,camera);};
  r.update=function(this:any,...args:any[]){drawn=undefined;const result=update.apply(this,args);if(drawn&&g.__cullingVehicle)g.__cullingRows.push({stage:g.__cullingStage,phase:g.state().carEntry.phase,bumper:this.bumperView,glance:this.glance,draw:drawn,after:visible(g.__cullingVehicle)});return result;};
  g.__restoreCulling=()=>{NativeCharacter.prototype.updateVehicle=pose;NativeCharacter.prototype.update=foot;r.update=update;r.renderer.render=draw;};
 });
 const rows:any[]=[];
 try{
  for(const model of [492,586,446]){
   let handle:number|undefined;
   if(model===446)await page.evaluate(async()=>{const g=(window as any).__game;g.placePlayer(2600,3,2600);const boat=await g.fleet().spawnBoat(446,2600,2601,0);boat.finishEnter();g.__cullingVehicle=boat.root;});
   else{
    handle=await page.evaluate(({model,p})=>(window as any).__game.missionForProfiling().vehicles.create(model,{x:p.x+6,y:-p.z+12,z:-100},90),{model,p:origin});
    await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),handle,{timeout:60000});
    await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.warpPedIntoCar(1,h);g.__cullingVehicle=m.vehicles.entity(h).car.root;},handle);
   }
   let passenger:number|undefined;
   if(model===492){passenger=await page.evaluate(p=>(window as any).__game.missionForProfiling().peds.create(4,'MALE01',{x:p.x+4,y:-p.z+8,z:-100}),origin);await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),passenger,{timeout:60000});await page.evaluate(({ped,vehicle})=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCarAsPassenger(ped,vehicle,0),{ped:passenger,vehicle:handle});}
   for(const mode of ['near','bumper','far']){
    const stage=`${model}-${mode}`;await page.evaluate(({mode,stage})=>{const g=(window as any).__game;g.render().cameraSettings.vehicle=mode;g.__cullingStage=stage;g.__cullingRows=[];},{mode,stage});
    await page.waitForFunction(({stage,count})=>(window as any).__game.__cullingRows.filter((r:any)=>r.stage===stage&&r.after.occupants.length>=count).length>=3,{stage,count:model===492?2:1},{timeout:30000});
    rows.push(...await page.evaluate(()=>(window as any).__game.__cullingRows.slice(-3)));if(mode==='bumper')await page.screenshot({path:`artifacts/firstperson-culling-${model}.png`});
   }
   if(model===492){
    await page.evaluate(()=>{const g=(window as any).__game;g.render().cameraSettings.vehicle='bumper';g.__cullingStage='492-exit';g.__cullingRows=[];});await page.keyboard.press('KeyF');
    await page.waitForFunction(()=>(window as any).__game.__cullingRows.filter((r:any)=>r.phase==='getOut').length>=3,undefined,{timeout:30000});rows.push(...await page.evaluate(()=>(window as any).__game.__cullingRows.filter((r:any)=>r.phase==='getOut').slice(-3).map((r:any)=>({...r,transition:true}))));
    await page.waitForFunction(()=>(window as any).__game.state().carEntry.phase===null,undefined,{timeout:30000});
   }
   await page.evaluate(({h,p,ped})=>{const g=(window as any).__game,w=g.missionForProfiling().runtime.world;g.__cullingVehicle=undefined;if(h===undefined){const b=g.fleet().occupiedBoat;b.finishExit(p);g.fleet().removeScriptVehicle(b);}else{w.warpPedFromCarToCoord(1,p.x,-p.z,p.y+1);if(ped!==undefined)w.deletePed(ped);w.deleteVehicle(h);}},{h:handle,p:origin,ped:passenger});
  }
 }finally{await page.evaluate(()=>(window as any).__game.__restoreCulling?.());writeFileSync('artifacts/firstperson-vehicle-culling-live.json',JSON.stringify({rows,errors},null,2));}
 expect(rows).toHaveLength(30);for(const row of rows){const visible=!row.bumper;expect(row.glance).toBe('none');expect(row.draw.vehicle).toBe(visible);expect(row.draw.player).toBe(row.transition||visible);expect(row.draw.occupants.every((p:any)=>p.visible===visible)).toBe(true);expect(row.after.vehicle).toBe(true);expect(row.after.player).toBe(true);expect(row.after.occupants.every((p:any)=>p.visible)).toBe(true);}expect(errors).toEqual([]);
});
