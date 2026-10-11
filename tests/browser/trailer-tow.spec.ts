import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A trailer's tow link (CVehicle::UpdateTrailerLink and UpdateTractorLink, iOS 0x100481eb4 and 0x100482240): CAT3,
 * TORENO2 and the trucking jobs put a tanker or a box trailer behind a rig with ATTACH_TRAILER_TO_CAB or have CJ back
 * under it (CTrailer::ScanForTowLink), then ask IS_TRAILER_ATTACHED_TO_CAB. The browser had no link: the commands were
 * skipped and the missions gave up. */
const PETRO=514,PETROTR=584;
async function start(page:Page){
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // Los Santos airport's south runway and the flat ground north of it.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,1600,-2593,13.6));
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:60000});
 await page.waitForTimeout(1000);
 return errors;
}
/** Makes the two north of the player, heading north, with the cab `ahead` units in front of the trailer's origin. */
async function make(page:Page,ahead:number){
 const made=await page.evaluate(({PETRO,PETROTR,ahead})=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  const trailer=m.vehicles.create(PETROTR,{x:p.x+6,y:-p.z+16,z:-100},0),cab=m.vehicles.create(PETRO,{x:p.x+6,y:-p.z+16+ahead,z:-100},0);
  return {trailer,cab};},{PETRO,PETROTR,ahead});
 for(const h of [made.trailer,made.cab])await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
 return made;
}
const link=(page:Page,made:{trailer:number;cab:number})=>page.evaluate(({trailer,cab})=>{
 const m=(window as any).__game.missionForProfiling(),w=m.runtime.world,t=m.vehicles.entity(trailer),c=m.vehicles.entity(cab);
 const hitch=t.towHitchPos(true,c),bar=c.towBarPos(true,t),q=t.car.body.rotation(),p=t.car.body.translation(),cp=c.car.body.translation();
 return {attached:w.trailerIsAttachedToCab(trailer,cab),any:w.trailerIsAttachedToCab(trailer,-1),gap:Math.hypot(hitch.x-bar.x,hitch.y-bar.y,hitch.z-bar.z),
  up:1-2*(q.x*q.x+q.z*q.z),legs:t.trailerLegs?.extension,trailer:{x:p.x,y:-p.z},cab:{x:cp.x,y:-cp.z}};},made);

test('ATTACH_TRAILER_TO_CAB puts the tanker on the rig\'s bar, it follows the rig, and DETACH lets it go',async({page})=>{
 test.setTimeout(240000);const errors=await start(page);
 const made=await make(page,30);
 expect((await link(page,made)).attached).toBe(false);
 await page.evaluate(({trailer,cab})=>(window as any).__game.missionForProfiling().runtime.world.attachTrailerToCab(trailer,cab),made);
 const placed=await link(page,made);
 expect(placed.attached).toBe(true);expect(placed.any).toBe(true);
 // Its legs are up at once, and it stands with its hitch on the bar.
 expect(placed.legs).toBe(0);
 await page.waitForTimeout(2000);
 const settled=await link(page,made);
 expect(settled.attached).toBe(true);expect(settled.gap).toBeLessThan(.3);expect(settled.up).toBeGreaterThan(Math.cos(5*Math.PI/180));
 // CJ drives the rig north: the tanker comes along, on the bar.
 await page.evaluate(cab=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,cab),made.cab);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCar?.occupied),{timeout:15000}).toBe(true);
 await page.keyboard.down('KeyW');await page.waitForTimeout(4000);
 const driving=await link(page,made);await page.keyboard.up('KeyW');
 expect(driving.cab.y-settled.cab.y).toBeGreaterThan(10);
 expect(driving.trailer.y-settled.trailer.y).toBeGreaterThan(10);
 expect(driving.attached).toBe(true);expect(driving.gap).toBeLessThan(.7);
 // DETACH_TRAILER_FROM_CAB (the cab is not asked).
 await page.evaluate(({trailer})=>(window as any).__game.missionForProfiling().runtime.world.detachTrailerFromCab(trailer,-1),made);
 const free=await link(page,made);
 expect(free.attached).toBe(false);expect(free.any).toBe(false);
 expect(errors).toEqual([]);
});

test('a rig backed under a parked tanker takes it on its bar by itself',async({page})=>{
 test.setTimeout(240000);const errors=await start(page);
 // The hitch is 6.8 ahead of the tanker's origin and the PETRO's bar 3.5 behind its own: 4 units clear.
 const made=await make(page,6.8+3.5+4);
 await page.waitForTimeout(1500);
 const parked=await link(page,made);
 expect(parked.attached).toBe(false);expect(parked.legs).toBe(1);expect(parked.gap).toBeGreaterThan(3);
 await page.evaluate(cab=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,cab),made.cab);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCar?.occupied),{timeout:15000}).toBe(true);
 // Back up (the brake, then reverse) until it hitches.
 await page.keyboard.down('KeyS');
 await expect.poll(async()=>(await link(page,made)).attached,{timeout:15000}).toBe(true);
 await page.keyboard.up('KeyS');
 // Hitched: its legs come up, and driving off it follows.
 await page.waitForTimeout(1000);
 const hitched=await link(page,made);
 expect(hitched.legs).toBeLessThan(1);
 await page.keyboard.down('KeyW');await page.waitForTimeout(3000);await page.keyboard.up('KeyW');
 const away=await link(page,made);
 expect(away.attached).toBe(true);expect(away.trailer.y-hitched.trailer.y).toBeGreaterThan(5);
 expect(errors).toEqual([]);
});
