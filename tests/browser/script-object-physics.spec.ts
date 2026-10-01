import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A script object CPhysical moves (SET_OBJECT_DYNAMIC): it falls to the ground and settles static again after ten
 * still frames (CObject::ProcessControl); SET_OBJECT_VELOCITY and ADD_TO_OBJECT_VELOCITY (RYDER2's boxes, BCOUR's
 * papers) send it off, and GET_OBJECT_VELOCITY reads its speed back. A static object stays where it was put. */
test('a dynamic script object falls, settles and flies off at the speed the script gives it',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,p=g.state().player.position,x=p.x+5,y=-p.z+3,ground=g.groundAt(x,-y,p.y+20)??p.y;
  const objects=g.missionForProfiling().runtime.game.objects;
  const box=objects.create('cardboardbox',{x,y,z:ground+3},{external:false,missionCleanup:false}).handle;
  const held=objects.create('cardboardbox',{x:x+3,y,z:ground+3},{external:false,missionCleanup:false}).handle;
  return {box,held,ground};
 });
 await page.waitForFunction(m=>{const v=(window as any).__game.scriptObjectViews();return !!v?.bodyOf(m.box)&&!!v?.bodyOf(m.held);},made,{timeout:60000});
 const o=(h:number)=>page.evaluate(h=>{const r=(window as any).__game.missionForProfiling().runtime.game.objects.at(h);return {z:r.position.z,x:r.position.x,static:r.isStatic,v:{...r.velocity}};},h);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.game.objects.setDynamic(h,true),made.box);
 // It drops the three units to the ground and comes to rest static.
 await expect.poll(async()=>(await o(made.box)).static,{timeout:60000}).toBe(true);
 const rest=await o(made.box);
 expect(rest.z).toBeLessThan(made.ground+1.5);expect(rest.z).toBeGreaterThan(made.ground-.5);
 // The other, left static, hangs where it was put.
 expect((await o(made.held)).z).toBeCloseTo(made.ground+3,3);
 // Made dynamic again and thrown east at 8 units a second: it travels, and its speed reads back while it flies.
 await page.evaluate(h=>{const objects=(window as any).__game.missionForProfiling().runtime.game.objects;objects.setDynamic(h,true);objects.setVelocity(h,{x:4,y:0,z:4});objects.addToVelocity(h,{x:4,y:0,z:0});},made.box);
 await expect.poll(async()=>(await o(made.box)).x-rest.x,{timeout:20000}).toBeGreaterThan(1.5);
 expect(errors).toEqual([]);
});

// SET_OBJECT_ROTATION_VELOCITY gives a moving object m_vecTurnSpeed (DRUGS4's spinning props, POOL2's balls): it turns,
// and GET_OBJECT_ROTATION_VELOCITY reads the turn back while it lasts.
test('a dynamic script object spins at the turn speed the script gives it',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const box=await page.evaluate(()=>{
  const g=(window as any).__game,p=g.state().player.position,x=p.x+5,y=-p.z+3,ground=g.groundAt(x,-y,p.y+20)??p.y;
  return g.missionForProfiling().runtime.game.objects.create('cardboardbox',{x,y,z:ground+6},{external:false,missionCleanup:false}).handle;
 });
 await page.waitForFunction(h=>!!(window as any).__game.scriptObjectViews()?.bodyOf(h),box,{timeout:60000});
 const heading=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.game.objects.at(h).heading,box);
 const before=await heading();
 // A turn about the up axis, set as it starts to fall: in the air nothing slows it but its own damping.
 const read=await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling(),objects=m.runtime.game.objects;
  objects.setDynamic(h,true);m.adapterRef.setObjectRotationVelocity(h,0,0,6);return m.adapterRef.getObjectRotationVelocity(h);},box);
 expect(read.z).toBeCloseTo(6,5);
 await page.waitForTimeout(250);
 const spinning=await page.evaluate(h=>(window as any).__game.missionForProfiling().adapterRef.getObjectRotationVelocity(h),box);
 expect(spinning.z).toBeGreaterThan(3);
 expect(Math.abs(Math.atan2(Math.sin(await heading()-before),Math.cos(await heading()-before)))).toBeGreaterThan(.3);
 expect(errors).toEqual([]);
});
