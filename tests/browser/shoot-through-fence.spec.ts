import {test,expect} from '@playwright/test';
// CWeapon's line tests (FireInstantHit, CBulletInfo::Update) pass ProcessLineOfSight's doShootThroughCheck, which skips
// SURFINFO shoot-through faces: a shot at a chain-link fence goes on to whatever stands behind it.
test('a bullet line test passes through a chain-link fence',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placePlayer(2520,20,1660));
 await expect.poll(async()=>(await state()).player.grounded,{timeout:30000}).toBe(true);
 // The probe's plain ray stops on the fence's face; the weapon's line test from the same point goes past it.
 let fence:any=null;
 await expect.poll(async()=>(fence=await page.evaluate(()=>(window as any).__game.shootThroughProbe(30,.7))),{timeout:20000}).not.toBeNull();
 const reach=await page.evaluate(f=>(window as any).__game.lineOfFire(f.from,f.dir,60),fence);
 expect(reach===null||reach>fence.distance+.05).toBe(true);
 expect(errors).toEqual([]);
});
