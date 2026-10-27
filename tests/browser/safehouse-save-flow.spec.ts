import {test,expect,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

const play=(page:Page)=>page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
async function enterHouse(page:Page){
 await page.goto('/');await play(page);await endStoryMission(page);
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.entryExits?.count===376&&s.player.grounded&&!s.terrainHold;},undefined,{timeout:60000});
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2495.33,g.groundAt(2495.33,1690.75,16),1690.75);});
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.lighting.area===3&&!s.entryExits.loading&&s.player.grounded&&s.fadeAlpha===0;},undefined,{timeout:120000});
 expect(await page.evaluate(()=>(window as any).__game.state().entryExits.stack)).toEqual(['CARLS']);
 const point=await page.evaluate(async()=>{const path='/src/assets/scmSavePoints.ts',{readInitialSavePoints}=await import(path);return readInitialSavePoints(new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer())).find((p:any)=>p.slot===0);});
 expect(point).toBeDefined();return point;
}
test('walking into the original house save disc applies save effects and reloads through its interior entry stack',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const rows:any[]=[];
 const point=await enterHouse(page);rows.push({mode:'original disc',point});
 rows.push({mode:'approach',...await page.evaluate(async point=>{
  const path='/src/simulation/WorldPickups.ts',{WorldPickups}=await import(path);
  const g=(window as any).__game,w=g.missionForProfiling().runtime.world,x=point.respawn[0],y=point.respawn[1],floor=g.groundAt(x,-y,point.pickup[2]+1);
  if(floor===null)throw new Error('No original house floor beside the save disc.');
  w.setPedCoordinatesNoOffset(1,x,y,floor);w.setCharHeading(1,180);g.render().yaw=g.sim.player.heading+Math.PI;
  const t=(window as any).__safehouseSave={original:g.sim.passTime,passes:[] as any[],collect:WorldPickups.prototype.collect,collects:[] as any[]};
  WorldPickups.prototype.collect=function(this:any,state:any){if(state.pickup.category==='save')t.collects.push({id:state.pickup.id,position:{...g.sim.player.position},grounded:g.sim.player.grounded});return t.collect.call(this,state);};
  g.sim.passTime=function(this:any,minutes:number){const before=this.timeMinutes,result=t.original.call(this,minutes);t.passes.push({minutes,before,after:this.timeMinutes});return result;};
  g.sim.player.health=25;g.sim.player.stamina=-50;
  return {floor,position:{...g.sim.player.position},heading:g.sim.player.heading};
 },point)});
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded);
 try{
  await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>(window as any).__safehouseSave.collects.length>0,undefined,{timeout:30000});await page.keyboard.up('KeyW');
  await page.waitForFunction(()=>(window as any).__safehouseSave.passes.length>0,undefined,{timeout:15000});
  await page.waitForFunction(()=>{const g=(window as any).__game,saved=JSON.parse(localStorage.getItem('web-gta.progress.v1')??'null');return g.state().fadeAlpha===0&&saved?.savedLocation?.area===3;},undefined,{timeout:15000});
  const saved=await page.evaluate(()=>{const g=(window as any).__game,s=g.state();return {passes:(window as any).__safehouseSave.passes,save:JSON.parse(localStorage.getItem('web-gta.progress.v1')??'null'),position:{...g.sim.player.position},health:g.sim.player.health,stamina:g.sim.player.stamina,capacity:g.sim.playerSprintCapacity(),grounded:g.sim.player.grounded,stack:s.entryExits.stack,area:s.lighting.area};});
  rows.push({mode:'saved',...saved});expect(saved.passes).toHaveLength(1);expect(saved.passes[0].minutes).toBe(360);expect((saved.passes[0].after-saved.passes[0].before+1440)%1440).toBeCloseTo(360,6);
  expect(saved.health).toBe(100);expect(saved.stamina).toBe(saved.capacity);expect(saved.area).toBe(3);expect(saved.stack).toEqual(['CARLS']);expect(saved.grounded).toBe(true);
  const location=saved.save.savedLocation;expect([location.x,location.y,location.z]).toEqual(point.respawn);expect(location.area).toBe(3);expect(location.enexStack).toHaveLength(1);
  expect(Math.hypot(saved.position.x-point.respawn[0],saved.position.z+point.respawn[1])).toBeLessThan(.75);
  await expect(page.locator('.screen-fade')).toHaveCSS('opacity','0');await page.screenshot({path:'artifacts/safehouse-save-flow.png'});
 }finally{await page.keyboard.up('KeyW');rows.push({mode:'observed',...await page.evaluate(async()=>{const g=(window as any).__game,t=(window as any).__safehouseSave,path='/src/simulation/WorldPickups.ts',{WorldPickups}=await import(path);if(!t)return {};g.sim.passTime=t.original;WorldPickups.prototype.collect=t.collect;return {collects:t.collects,passes:t.passes};})});writeFileSync('artifacts/safehouse-save-flow.json',JSON.stringify({rows,errors},null,2));}
 await page.reload();await play(page);
 await page.waitForFunction(()=>{const g=(window as any).__game,s=g.state();return s.lighting.area===3&&!s.entryExits.loading&&g.sim.player.grounded;},undefined,{timeout:120000});
 const restored=await page.evaluate(()=>{const g=(window as any).__game,s=g.state();return {position:{...g.sim.player.position},stack:s.entryExits.stack,minutes:g.sim.timeMinutes,area:s.lighting.area};});
 rows.push({mode:'restored',...restored});expect(restored.stack).toEqual(['CARLS']);expect(Math.hypot(restored.position.x-point.respawn[0],restored.position.z+point.respawn[1])).toBeLessThan(1);
 writeFileSync('artifacts/safehouse-save-flow.json',JSON.stringify({rows,errors},null,2));expect(errors).toEqual([]);
});

test('an active scripted primary task blocks the original save disc without healing or advancing six hours',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const point=await enterHouse(page);
 const before=await page.evaluate(point=>{
  const g=(window as any).__game,w=g.missionForProfiling().runtime.world,x=point.pickup[0],y=point.pickup[1],floor=g.groundAt(x,-y,point.pickup[2]);
  if(floor===null)throw new Error('No original floor at the save disc.');w.setPedCoordinatesNoOffset(1,x,y,floor);
  w.givePedScriptedTask(1,{kind:'standStill',time:60000},0x05ba);g.sim.player.health=25;
  const t=(window as any).__taskSave={original:g.sim.passTime,passes:[] as number[]};g.sim.passTime=function(this:any,minutes:number){t.passes.push(minutes);return t.original.call(this,minutes);};
  return {minute:g.sim.timeMinutes,position:{...g.sim.player.position},task:w.scriptTaskStatus(1,0x05ba)};
 },point);
 try{
  await page.waitForFunction(minute=>{const g=(window as any).__game;return (window as any).__taskSave.passes.length>0||(g.sim.timeMinutes-minute+1440)%1440>=2;},before.minute,{timeout:30000});
  const after=await page.evaluate(()=>{const g=(window as any).__game;return {minute:g.sim.timeMinutes,health:g.sim.player.health,passes:(window as any).__taskSave.passes,task:g.missionForProfiling().runtime.world.scriptTaskStatus(1,0x05ba),savedLocation:JSON.parse(localStorage.getItem('web-gta.progress.v1')??'null')?.savedLocation??null};});
  writeFileSync('artifacts/safehouse-save-task.json',JSON.stringify({point,before,after,errors},null,2));expect(after.passes).toEqual([]);expect(after.health).toBe(25);expect(after.task).toBe(1);expect(after.savedLocation).toBeNull();expect(errors).toEqual([]);
 }finally{await page.evaluate(()=>{const g=(window as any).__game;g.sim.passTime=(window as any).__taskSave.original;g.missionForProfiling().runtime.world.clearPedTasks(1);});}
});
