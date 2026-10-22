import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('ZERO4 barrel queries its current COL pose even with collision and collision records off',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const h=await page.evaluate(()=>{
  const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1);
  return m.runtime.game.objects.create('barrel2',{x:p.x+20,y:p.y,z:p.z+20},{external:false,missionCleanup:false}).handle;
 });
 await page.waitForFunction(h=>!!(window as any).__game.scriptObjectViews()?.bodyOf(h),h,{timeout:90000});
 const query=()=>page.evaluate(h=>{const m=(window as any).__game.missionForProfiling();try{return m.runtime.world.isObjectIntersectingWorld(h);}catch(error){if((error as {command?:string}).command==='AN_ENTITY_THE_BROWSER_IS_STILL_BUILDING')return 'pending';throw error;}},h);
 await expect.poll(query,{timeout:30000}).toBe(false);
 const fixture=await page.evaluate(async h=>{
  const path='/tests/fixtures/native-render-dependencies.ts',{RAPIER,THREE}=await import(/* @vite-ignore */ path);
  const g=(window as any).__game,v=g.scriptObjectViews(),c=v.bodyOf(h).collider(0),p=c.translation(),shape=c.shape;
  // A contact against the actual model geometry; place a small sphere on its first triangle vertex when needed.
  const at=shape.vertices?new THREE.Vector3(shape.vertices[0],shape.vertices[1],shape.vertices[2]).applyQuaternion(new THREE.Quaternion().copy(c.rotation())).add(p):p;
  const obstacle=g.sim.world.createCollider(RAPIER.ColliderDesc.ball(.3).setTranslation(at.x,at.y,at.z));
  return obstacle.handle as number;
 },h);
 await expect.poll(query,{timeout:10000}).toBe(true);
 const result=await page.evaluate(h=>{
  const g=(window as any).__game,m=g.missionForProfiling(),o=m.runtime.game.objects.at(h),before={...o.position};
  o.usesCollision=false;o.recordsCollisions=false;
  const collisionOff=m.runtime.world.isObjectIntersectingWorld(h);
  // No physics or render frame between the moves and queries: the script record must supply the pose.
  m.runtime.game.objects.setPosition(h,{...before,x:before.x+50});const far=m.runtime.world.isObjectIntersectingWorld(h);
  m.runtime.game.objects.setPosition(h,before);const back=m.runtime.world.isObjectIntersectingWorld(h);
  return {collisionOff,far,back,position:o.position,before,usesCollision:o.usesCollision,records:o.recordsCollisions};
 },h);
 expect(result.collisionOff).toBe(true);expect(result.far).toBe(false);expect(result.back).toBe(true);
 expect(result.position).toEqual(result.before);expect(result.usesCollision).toBe(false);expect(result.records).toBe(false);
 await page.waitForTimeout(100);expect(await query()).toBe(true);
 await page.evaluate(f=>{(window as any).__game.sim.world.removeCollider((window as any).__game.sim.world.getCollider(f),true);},fixture);
 await expect.poll(query,{timeout:10000}).toBe(false);expect(errors).toEqual([]);
});
