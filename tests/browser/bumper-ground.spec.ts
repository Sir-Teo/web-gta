import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('flipped bumper view grows the native ground lift, caps, resets and holds while paused',async({page})=>{
 test.setTimeout(180000);mkdirSync('artifacts',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 const handle=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+6,y:-p.z+12,z:-100},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),handle,{timeout:60000});
 await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.warpPedIntoCar(1,h);m.runtime.world.freezeVehiclePosition(h,true);g.__groundVehicle=m.vehicles.entity(h).car;},handle);
 await page.waitForFunction(()=>{const g=(window as any).__game;return !g.state().terrainHold&&g.render().nativeCharacter?.inVehiclePose;},undefined,{timeout:60000});
 await page.evaluate(()=>{
  const g=(window as any).__game,r=g.render(),update=r.update;let previous=0,activeLast=false;g.__groundRows=[];g.__groundStage='growth';
  r.update=function(this:any,...args:any[]){
   g.__groundLastArgs=args;const active=this.bumperView&&!this.fixedCamera,b=this.bumper,normal=b&&{...b.source},q=g.__groundVehicle.body.rotation(),upZ=1-2*(q.x*q.x+q.z*q.z),paused=!!args[4];
   if(!active||!activeLast)previous=0;
   const input={previous,upZ,sourceZ:normal?.y??0};
   if(active&&!paused)previous=upZ<=Math.fround(-.9)?previous>=.5?.5:Math.fround(previous+Math.fround(.03)):previous>=0?0:Math.fround(previous-Math.fround(.03));
   activeLast=active;const result=update.apply(this,args);
   if(normal)g.__groundRows.push({stage:g.__groundStage,active,paused,glance:this.glance,groundInput:input,expectedState:previous,expectedY:Math.fround(Math.fround(normal.y)+previous),cameraY:this.camera.position.y});return result;
  };
  g.__restoreGround=()=>r.update=update;
  g.__groundVehicle.body.setRotation({x:0,y:0,z:1,w:0},true);r.cameraSettings.vehicle='bumper';
 });
 try{
  await page.waitForFunction(()=>(window as any).__game.__groundRows.filter((r:any)=>r.stage==='growth'&&r.active).length>=24,undefined,{timeout:20000});
  await page.evaluate(()=>{const g=(window as any).__game;g.__groundStage='away';g.render().cameraSettings.vehicle='near';});
  await page.waitForFunction(()=>(window as any).__game.__groundRows.filter((r:any)=>r.stage==='away').length>=2);
  await page.evaluate(()=>{const g=(window as any).__game;g.__groundStage='reenter';g.render().cameraSettings.vehicle='bumper';});
  await page.waitForFunction(()=>(window as any).__game.__groundRows.filter((r:any)=>r.stage==='reenter').length>=3);
  await page.evaluate(()=>{const g=(window as any).__game,args=[...g.__groundLastArgs];args[0]=0;args[4]=true;g.__groundStage='pause';const source={...g.render().bumper.source};source.y=Math.fround(source.y-g.render().bumperGroundLift);for(let i=0;i<3;i++){g.render().bumper.source={...source};g.render().update(...args);}g.__groundStage='rear';});
  await page.keyboard.down('KeyQ');await page.keyboard.down('KeyE');
  await page.waitForFunction(()=>(window as any).__game.__groundRows.filter((r:any)=>r.stage==='rear'&&r.glance==='behind').length>=3);
  await page.keyboard.up('KeyQ');await page.keyboard.up('KeyE');
  await page.evaluate(()=>{const g=(window as any).__game;g.__groundStage='upright';g.__groundVehicle.body.setRotation({x:0,y:0,z:0,w:1},true);});
  await page.waitForFunction(()=>(window as any).__game.__groundRows.filter((r:any)=>r.stage==='upright'&&r.glance==='none').length>=3);
 }finally{await page.keyboard.up('KeyQ');await page.keyboard.up('KeyE');await page.evaluate(()=>(window as any).__game.__restoreGround?.());}
 const rows=await page.evaluate(()=>(window as any).__game.__groundRows);writeFileSync('artifacts/bumper-ground-live.json',JSON.stringify({rows,errors},null,2));
 const normal=rows.filter((r:any)=>r.active&&r.glance==='none');expect(normal.length).toBeGreaterThan(28);for(const row of normal)expect(row.cameraY,JSON.stringify(row)).toBe(row.expectedY);
 expect(rows.filter((r:any)=>r.stage==='pause')).toHaveLength(3);expect(rows.find((r:any)=>r.stage==='reenter').expectedState).toBe(Math.fround(.03));expect(rows.some((r:any)=>r.expectedState>.5)).toBe(true);expect(rows.some((r:any)=>r.stage==='growth'&&r.expectedState===.5)).toBe(true);expect(errors).toEqual([]);
});
