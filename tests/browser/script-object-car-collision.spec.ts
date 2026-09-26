import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SORT_OUT_OBJECT_COLLISION_WITH_CAR (RYDER2's crates, TRUTH1, STEAL4): the object's m_pEntityIgnoredCollision is the
 * car, so a crate set down inside the van and thrown out of the back passes through it; once their bounding spheres
 * part the ignore is let go (CPhysical::ProcessCollisionSectorList) and the two collide again. */
test('a crate inside a van passes out through it and collides with it again once clear',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const van=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(482,{x:p.x+10,y:-p.z,z:-100},0);});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)?.car.body.isEnabled(),van,{timeout:60000});
 await page.waitForTimeout(1500);
 const c=await w('vehiclePosition',van);
 const crate=await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.game.objects.create('cardboardbox',{x:c.x,y:c.y,z:c.z+.3},{external:false,missionCleanup:false}).handle,c);
 await page.waitForFunction((h:number)=>!!(window as any).__game.scriptObjectViews()?.bodyOf(h),crate,{timeout:60000});
 await w('sortOutObjectCollisionWithVehicle',crate,van);
 expect(await page.evaluate(()=>(window as any).__game.sortedOutCollisions())).toEqual([crate]); 
 // Thrown out of the back (the van faces north): it leaves through the van without being shoved about.
 await page.evaluate(h=>{const o=(window as any).__game.missionForProfiling().runtime.game.objects;o.setDynamic(h,true);o.setVelocity(h,{x:0,y:-6,z:1});},crate);
 // It comes to rest behind the van, having passed through it rather than being shoved out sideways or up.
 await page.waitForTimeout(3000);
 const at=await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.game.objects.at(h).position,crate);
 expect(c.y-at.y).toBeGreaterThan(2);expect(Math.abs(at.x-c.x)).toBeLessThan(.5);expect(at.z).toBeLessThan(c.z+1);
 // Still within the van's bounding sphere, the ignore holds; the van driven off parts them and lets it go.
 expect(await page.evaluate(()=>(window as any).__game.sortedOutCollisions())).toEqual([crate]);
 await w('setVehicleCoordinates',van,c.x,c.y+15,c.z);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.sortedOutCollisions().length),{timeout:20000}).toBe(0);
 // Deleting the object or the car lets go as well.
 const second=await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.game.objects.create('cardboardbox',{x:c.x,y:c.y,z:c.z+.3},{external:false,missionCleanup:false}).handle,c);
 await page.waitForFunction((h:number)=>!!(window as any).__game.scriptObjectViews()?.bodyOf(h),second,{timeout:60000});
 await w('sortOutObjectCollisionWithVehicle',second,van);
 await w('deleteVehicle',van);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.sortedOutCollisions().length),{timeout:10000}).toBe(0);
 expect(errors).toEqual([]);
});
