import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** ATTACH_CHAR_TO_OBJECT on the player (the shooting range's stand, HEIST5, MANSIO1, CASINO9): CPed::AttachPedToEntity
 * on a script object holds him at the offset in its axes with the given weapon chosen; he goes where it goes; and
 * DETACH_CHAR_FROM_CAR lets him go with the weapon he had back. A script ped hangs from one too (SMOKE3, CASINO5). */
test('the player hangs from a script object at an offset, follows it, and is let go with his own gun',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const box=await page.evaluate(()=>{
  const g=(window as any).__game,p=g.state().player.position,x=p.x+5,y=-p.z+3,ground=g.groundAt(x,-y,p.y+20)??p.y;
  const inv=g.weapons().inventory;inv.give(22,40);inv.select(22);
  return g.missionForProfiling().runtime.game.objects.create('cardboardbox',{x,y,z:ground+.5},{external:false,missionCleanup:false}).handle;
 });
 await page.waitForFunction((h:number)=>!!(window as any).__game.scriptObjectViews()?.bodyOf(h),box,{timeout:60000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const pistol=await page.evaluate(()=>{const a=(window as any).__game.weapons().inventory.ammo.get(22);return a.clip+a.reserve;});
 // A metre and a half above it with an M4.
 await w('attachPedToObject',1,box,{x:0,y:0,z:1.5},0,Math.PI,31);
 expect(await page.evaluate(()=>(window as any).__game.weapons().inventory.selected)).toBe(31);
 const where=async()=>{const o=await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.game.objects.at(h).position,box),p=await w('pedPosition',1);return {dx:p.x-o.x,dy:p.y-o.y,dz:p.z-o.z};};
 await expect.poll(async()=>{const d=await where();return Math.hypot(d.dx,d.dy)+Math.abs(d.dz-1.5);},{timeout:15000}).toBeLessThan(.3);
 // The object is put 15 units east; he goes with it.
 await page.evaluate(h=>{const o=(window as any).__game.missionForProfiling().runtime.game.objects,p=o.at(h).position;o.setPosition(h,{x:p.x+15,y:p.y,z:p.z});},box);
 await expect.poll(async()=>{const d=await where();return Math.hypot(d.dx,d.dy)+Math.abs(d.dz-1.5);},{timeout:15000}).toBeLessThan(.3);
 await w('detachPedFromCar',1);
 const back=await page.evaluate(()=>{const inv=(window as any).__game.weapons().inventory,a=inv.ammo.get(22),m4=inv.ammo.get(31);return {selected:inv.selected,pistol:a.clip+a.reserve,m4:m4.clip+m4.reserve};});
 expect(back).toEqual({selected:22,pistol,m4:0});
 // A script ped is held at its offset in the object's frame the same way.
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+4,y:-p.z-3,z:p.y});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 expect(await page.evaluate(({ped,box})=>{try{(window as any).__game.missionForProfiling().runtime.world.attachPedToObject(ped,box,{x:0,y:0,z:1},0,0,0);return 'taken';}catch(e){return String(e);}},{ped,box})).toBe('taken');
 await expect.poll(async()=>{
  const o=await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.game.objects.at(h).position,box),p=await w('pedPosition',ped) as {x:number;y:number;z:number};
  return Math.hypot(p.x-o.x,p.y-o.y)+Math.abs(p.z-o.z-1);
 },{timeout:15000}).toBeLessThan(.3);
 expect(errors).toEqual([]);
});
