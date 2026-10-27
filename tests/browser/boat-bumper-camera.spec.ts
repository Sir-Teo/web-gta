import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('boat bumper cameras follow dummy slot zero at the helm, with a world-height lift',async({page})=>{
 test.setTimeout(240000);mkdirSync('artifacts',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 await page.evaluate(async()=>{
  const path='/src/simulation/recordingBody.ts',{nativeMatrixOf}=await import(path),g=(window as any).__game,r=g.render(),original=r.update;
  g.__boatBumperRows=[];
  r.update=function(this:any,...args:any[]){
   const result=original.apply(this,args),b=g.fleet().occupiedBoat;
   if(b&&this.bumperView){
    const seat=b.seat(),expected=b.root.localToWorld(b.root.position.clone().set(0,seat.z+.62,-seat.y-.08));expected.y+=.5;
    g.__boatBumperRows.push({model:b.modelId,timeMs:g.weapons().nowMs,seat,sourceInput:{boat:true,dummy:[seat.x,seat.y,seat.z],matrix:nativeMatrixOf(b.root.quaternion,b.root.position)},source:{...this.bumper.source},camera:this.camera.position.toArray(),position:b.root.position.toArray(),quaternion:b.root.quaternion.toArray(),expected:expected.toArray(),error:this.camera.position.distanceTo(expected),fov:this.fov,terrainHold:g.state().terrainHold});
   }
   return result;
  };
  g.__restoreBoatBumper=()=>{r.update=original;};
 });
 const rows:any[]=[];
 try{
  for(const id of [430,446,452,453,454,472,473,484,493,595]){
   await page.evaluate(async id=>{const g=(window as any).__game;g.placePlayer(2600,3,2600);const boat=await g.fleet().spawnBoat(id,2600,2601,0);boat.finishEnter();g.render().cameraSettings.vehicle='bumper';g.__boatBumperRows=[];},id);
   await page.waitForFunction(id=>(window as any).__game.__boatBumperRows.filter((r:any)=>r.model===id).length>=10,id,{timeout:30000});
   rows.push(...await page.evaluate(()=>(window as any).__game.__boatBumperRows.slice(-10)));await page.screenshot({path:`artifacts/boat-bumper-camera-${id}.png`});
   if(id===595){
    await page.waitForFunction(()=>(window as any).__game.state().terrainHold===false,undefined,{timeout:60000});const start=await page.evaluate(()=>(window as any).__game.weapons().nowMs);
    await page.keyboard.down('KeyW');await page.keyboard.down('KeyA');
    try{await page.waitForFunction(start=>(window as any).__game.weapons().nowMs>start+600,start,{timeout:30000});rows.push(...await page.evaluate(()=>(window as any).__game.__boatBumperRows.filter((r:any)=>!r.terrainHold).slice(-10)));}
    finally{await page.keyboard.up('KeyW');await page.keyboard.up('KeyA');}
   }
   await page.evaluate(()=>{const g=(window as any).__game,b=g.fleet().occupiedBoat;b.finishExit({x:2605,y:3,z:2605});g.fleet().removeScriptVehicle(b);});
  }
 }finally{const last=await page.evaluate(()=>{const g=(window as any).__game,b=g.render().bumper;g.__restoreBoatBumper?.();return {frames:g.__boatBumperRows,state:{mode:g.render().cameraSettings.vehicle,bumper:b&&{source:b.source,quaternion:b.quaternion},terrainHold:g.state().terrainHold,boat:g.fleet().occupiedBoat?.modelId}};});writeFileSync('artifacts/boat-bumper-camera-live.json',JSON.stringify({rows,errors,last},null,2));}
 expect(rows).toHaveLength(110);expect(rows.slice(-10).every(r=>!r.terrainHold)).toBe(true);for(const row of rows){expect(row.error,JSON.stringify(row)).toBeLessThan(1e-5);expect(row.fov).toBe(60);}expect(errors).toEqual([]);
});
