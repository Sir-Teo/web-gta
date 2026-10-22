import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('script-controlled loader parts move their original COL and visible frames without changing shared assets',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const handles=await page.evaluate(()=>{
  const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1);
  return [530,486,443,406].map((id,i)=>m.vehicles.create(id,{x:p.x+15+i*12,y:p.y,z:p.z+10}));
 });
 await page.waitForFunction(hs=>hs.every(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)),handles,{timeout:90000});
 const samples=await page.evaluate(async hs=>{
  const dependencies='/tests/fixtures/native-render-dependencies.ts', {RAPIER,THREE}=await import(/* @vite-ignore */ dependencies),g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world;
  return hs.map(h=>{
   const car=m.vehicles.entity(h),original=car.assets.collision,frame=car.car.root.getObjectByName('misc_a'),rest=frame.matrix.clone();
   const meshEntry=[...car.car.sources].find(([,s]:any)=>s.kind==='mesh') as any,source=meshEntry[1].mesh,collider=g.sim.world.getCollider(meshEntry[0]),before=[...source.positions];
   // Test at a front-most moving triangle, away from the stationary chassis.
   let index=-1,front=-Infinity;
   for(let t=0;t<original.mesh.materials.length;t++)if(original.mesh.materials[t]===65){const ids=[0,1,2].map(i=>original.mesh.indices[t*3+i]*3),y=ids.reduce((v,i)=>v+original.mesh.positions[i+1],0)/3;if(y>front){front=y;index=t;}}
   if(index<0)throw new Error(`No surface-65 triangle on ${car.modelId}`);
   const ids=[0,1,2].map(i=>original.mesh.indices[index*3+i]*3),point=[0,1,2].map(a=>ids.reduce((v,i)=>v+original.mesh.positions[i+a],0)/3);
   let physical:undefined|{old:boolean;raisedBefore:boolean;raisedAfter:boolean;oldAfter:boolean};
   if(car.modelId===530){
    const toWorld=(z:number)=>new THREE.Vector3(point[0],z,-point[1]).applyQuaternion(car.car.body.rotation()).add(car.car.body.translation());
    const hit=(z:number)=>collider.intersectsShape(new RAPIER.Ball(.01),toWorld(z),{x:0,y:0,z:0,w:1});
    physical={old:hit(point[2]),raisedBefore:hit(point[2]+1.5),raisedAfter:false,oldAfter:false};
    w.controlMovableVehiclePart(h,1);physical.raisedAfter=hit(point[2]+1.5);physical.oldAfter=hit(point[2]);
   }else w.controlMovableVehiclePart(h,1);
   const raised=w.getCarMovingComponentOffset(h),changed=source.positions.some((v:number,i:number)=>v!==before[i]),drawn=frame.matrix.elements.some((v:number,i:number)=>v!==rest.elements[i]);
   w.controlMovableVehiclePart(h,.5);const half=w.getCarMovingComponentOffset(h);
   w.controlMovableVehiclePart(h,0);const reset=[...source.positions].every((v,i)=>Math.abs(v-before[i])<1e-5),drawReset=frame.matrix.elements.every((v:number,i:number)=>Math.abs(v-rest.elements[i])<1e-6);
   const untouched=original.mesh.positions.every((v:number,i:number)=>v===before[i]);
   return {model:car.modelId,raised,half,changed,drawn,reset,drawReset,untouched,physical};
  });
 },handles);
 console.log('moving parts',JSON.stringify(samples));
 for(const s of samples){expect(s.changed).toBe(true);expect(s.drawn).toBe(true);expect(s.reset).toBe(true);expect(s.drawReset).toBe(true);expect(s.untouched).toBe(true);expect(s.half).toBeCloseTo(s.raised/2,6);}
 const forklift=samples.find(s=>s.model===530)!;expect(forklift.raised).toBeCloseTo(1.5,6);
 expect(forklift.physical).toEqual({old:true,raisedBefore:false,raisedAfter:true,oldAfter:false});
 expect(samples.find(s=>s.model===443)!.raised).toBeCloseTo(-.25,6);expect(samples.find(s=>s.model===486)!.raised).toBeCloseTo(.5,6);expect(samples.find(s=>s.model===406)!.raised).toBeCloseTo(.5,6);
 // The same mechanism must respond to the real car-gun pad, not only direct script calls.
 const h=handles[0];await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.taskWarpCharIntoCarAsDriver(1,h);},h);
 await expect.poll(()=>page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).occupied,h)).toBe(true);
 const offset=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.getCarMovingComponentOffset(h),h);
 await page.keyboard.down('Numpad2');await expect.poll(offset,{timeout:10000}).toBeGreaterThan(.25);await page.keyboard.up('Numpad2');
 const high=await offset();await page.keyboard.down('Numpad8');await expect.poll(offset,{timeout:10000}).toBeLessThan(high-.1);await page.keyboard.up('Numpad8');
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPlayerControl(0,false));const held=await offset();
 await page.keyboard.down('Numpad2');await page.waitForTimeout(500);await page.keyboard.up('Numpad2');expect(await offset()).toBe(held);
 expect(errors).toEqual([]);
});

test.describe('touch loader controls',()=>{
 test.use({hasTouch:true});
 test('the Lift widget drives the forklift stick and releases it when the finger lifts',async({page})=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('grove-touch-v1',JSON.stringify({steering:'stick',steeringChosen:true})));
  await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
  await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
  const h=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1);return m.vehicles.create(530,{x:p.x+10,y:p.y,z:p.z+2});});
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
  await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.taskWarpCharIntoCarAsDriver(1,h),h);
  const lift=page.getByRole('button',{name:'Lift',exact:true});await expect(lift).toBeVisible();const b=(await lift.boundingBox())!;
  const drag=(type:string,y:number)=>lift.evaluate((button,{type,y,b})=>button.dispatchEvent(new PointerEvent(type,{pointerId:51,pointerType:'touch',clientX:b.x+b.width/2,clientY:y,bubbles:true,cancelable:true})),{type,y,b});
  const offset=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.getCarMovingComponentOffset(h),h);
  await drag('pointerdown',b.y+b.height/2);await drag('pointermove',b.y+b.height/2+b.width);
  await expect.poll(offset,{timeout:10000}).toBeGreaterThan(.2);await drag('pointerup',b.y+b.height/2+b.width);
  const after=await offset();await page.waitForTimeout(500);expect(await offset()).toBe(after);expect(errors).toEqual([]);
 });
});

test('the cement mixer rotates its original drum at the native rate and stops when wrecked',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const h=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1);return m.vehicles.create(524,{x:p.x+20,y:p.y,z:p.z+40});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
 const result=await page.evaluate(h=>{
  const m=(window as any).__game.missionForProfiling(),w=m.runtime.world,car=m.vehicles.entity(h),a=car.car.root.getObjectByName('misc_a'),b=car.car.root.getObjectByName('misc_b');
  if(!a||!b)throw new Error('Cement mixer frames are missing');car.body.setEnabled(true);car.cementClock=0;car.cementDrumPhase=0;
  const positions=[...a.matrix.elements.slice(12,15),...b.matrix.elements.slice(12,15)],deltas:number[]=[];
  for(const fraction of [0,.5,1]){w.controlMovableVehiclePart(h,fraction);const old=car.cementDrumPhase;car.afterStep(1/30);deltas.push(car.cementDrumPhase-old);}
  const phase=car.cementDrumPhase,drawnA=[...a.matrix.elements],drawnB=[...b.matrix.elements],offset=w.getCarMovingComponentOffset(h);
  car.blowUp();car.afterStep(1/30);
  return {positions,afterPositions:[...a.matrix.elements.slice(12,15),...b.matrix.elements.slice(12,15)],deltas,phase,drawnA,drawnB,offset,wrecked:car.wrecked,afterPhase:car.cementDrumPhase};
 },h);
 expect(result.deltas[0]).toBeCloseTo(.01*50/30,7);expect(result.deltas[1]/result.deltas[0]).toBeCloseTo(2,6);expect(result.deltas[2]/result.deltas[0]).toBeCloseTo(3,6);
 const pitch=Math.fround(-Math.PI/18);expect(result.drawnA[6]).toBeCloseTo(Math.sin(pitch),6);
 expect(result.drawnB[0]).toBeCloseTo(Math.cos(result.phase),6);expect(result.drawnB[1]).toBeCloseTo(Math.sin(pitch)*Math.sin(result.phase),6);expect(result.drawnB[8]).toBeCloseTo(Math.sin(result.phase),6);
 expect(result.offset).toBe(0);expect(result.wrecked).toBe(true);expect(result.afterPhase).toBe(result.phase);expect(result.afterPositions).toEqual(result.positions);expect(errors).toEqual([]);
});
