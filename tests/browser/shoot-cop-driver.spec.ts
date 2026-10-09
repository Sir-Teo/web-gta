import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('a pistol through the patrol car window wounds the cop at the wheel and the fatal shot leaves him dead out of the door or in the seat',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 await page.keyboard.type('turnuptheheat');await expect.poll(async()=>(await state()).wanted.level).toBe(2);
 await expect.poll(async()=>(await state()).police?.units.filter((u:any)=>u.crew>0).length??0,{timeout:30000}).toBeGreaterThan(0);
 await page.evaluate(()=>{const w=(window as any).__game.weapons();w.inventory.give(22,200);w.inventory.select(22);});
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);await page.waitForTimeout(800);
 // The first crewed unit, parked beside CJ; CJ stands 3 m off its driver's window.
 const target=await page.evaluate(()=>{const g=(window as any).__game;const s=g.state();const p=s.player.position;const u=s.police.units.find((u:any)=>u.crew>0);g.placeFleetCar('handle:'+u.handle,p.x+4,p.y+.5,p.z,0);return u.handle;});
 await page.waitForTimeout(600);
 const unit=async()=>(await state()).police.units.find((u:any)=>u.handle===target);
 const shoot=()=>page.evaluate((handle:number)=>{const g=(window as any).__game;const head=g.driverHead(handle);const s=g.state();const p=s.player.position;
  const eye={x:head.x-3,y:head.y,z:head.z};g.placePlayer(eye.x,p.y,eye.z);g.turnPlayer(Math.PI/2);
  // The bullet leaves the muzzle for the point the crosshair line first meets (Find3rdPersonCamTargetVector): the
  // crosshair laid along the muzzle-to-head line puts the shot through the head sphere.
  const m=g.weapons().muzzle?.()??{x:eye.x,y:p.y+1.3,z:eye.z},d={x:head.x-m.x,y:head.y-m.y,z:head.z-m.z},l=Math.hypot(d.x,d.y,d.z);
  return g.weapons().fire({origin:{...m},direction:{x:d.x/l,y:d.y/l,z:d.z/l}});},target);
 // The free-aim spread can carry a shot off the 0.2 head sphere: a few, as a player fires.
 await expect.poll(async()=>{await shoot();await page.waitForTimeout(200);return (await unit())?.health[0];},{timeout:10000,intervals:[0]}).toBeLessThan(100);
 // (The pistol fires about every other try at this pace, and on a loaded machine the game runs slower than the clock.)
 for(let i=0;i<40;i++){const u=await unit();if(!u||u.dying||u.dead[0]||u.crew===0)break;await shoot();await page.waitForTimeout(250);}
 const dying=await unit();expect(dying.dying||dying.dead[0]||dying.crew===0).toBe(true);
 // 2000 ms of game time on: the driver is dead, out of the door (a body by the car) or in his seat, and the car stops.
 await expect.poll(async()=>{const u=await unit();return !u.dying;},{timeout:30000}).toBe(true);
 await expect.poll(async()=>{const s=await state(),u=s.police.units.find((x:any)=>x.handle===target);
  const body=s.pedestrians.people.find((p:any)=>p.health<=0&&Math.hypot(p.position.x-u.position.x,p.position.z-u.position.z)<6);
  return !!body||u.dead[0];},{timeout:30000}).toBe(true);
 await expect.poll(async()=>(await state()).police.units.find((x:any)=>x.handle===target).speed,{timeout:30000}).toBeLessThan(1.5);
 expect(errors).toEqual([]);
});
