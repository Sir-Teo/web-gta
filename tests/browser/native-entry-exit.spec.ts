import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

/** Interiors stream from MODELS\GTA_INT.IMG, published beside gta3.img only when the world manifest lists it. */
const interiorsPublished=(JSON.parse(readFileSync('public/play/world/manifest.json','utf8')).archives??[]).some((a:{name:string})=>a.name==='gta_int.img');
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
async function atCarlsDoor(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await expect.poll(async()=>(await state(page)).entryExits?.count,{timeout:90000}).toBe(376);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 // The CARLS door: native (2495.33, -1690.75), under the porch roof.
 const ground=await page.evaluate(()=>(window as any).__game.groundAt(2495.33,1690.75,16));
 expect(ground).toBeCloseTo(13.77,1);
 await page.evaluate(g=>(window as any).__game.placePlayer(2495.33,g,1690.75),ground);
}

test('a door into an interior that cannot stream stays shut',async({page})=>{
 test.skip(interiorsPublished,'Interiors are published.');test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await atCarlsDoor(page);await page.waitForTimeout(2000);
 const s=await state(page);expect(s.entryExits).toMatchObject({state:0,active:null,loading:false});expect(s.lighting.area).toBe(0);expect(s.fadeAlpha).toBe(0);
 expect(errors).toEqual([]);
});

// CEntryExitManager::Update and CEntryExit::TransitionStarted/TransitionFinished: CJ's front door (CARLS) warps him into
// area 3 above Grove Street, and the interior door brings him back out.
test('CJ walks into his house and back out through the entry exits',async({page})=>{
 test.skip(!interiorsPublished,'Requires gta_int.img published with the world.');test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await atCarlsDoor(page);
 await expect.poll(async()=>(await state(page)).lighting.area,{timeout:120000}).toBe(3);
 await expect.poll(async()=>(await state(page)).entryExits.loading,{timeout:60000}).toBe(false);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:30000}).toBe(true);
 const inside=await state(page);
 // The interior CARLS exit (2496.05, -1692.93, 1013.75): CJ lands on the floor of his house.
 expect(Math.hypot(inside.player.position.x-2496.05,inside.player.position.z-1692.93)).toBeLessThan(2.1);
 expect(inside.player.position.y).toBeGreaterThan(1012);expect(inside.player.position.y).toBeLessThan(1015);
 expect(inside.entryExits.stack).toEqual(['CARLS']);
 await expect.poll(async()=>(await state(page)).fadeAlpha,{timeout:10000}).toBe(0);
 await page.screenshot({path:'artifacts/native-entry-exit-inside.png'});
 // Leave: step off the arrival exit, then into the interior door.
 await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;g.placePlayer(2497.5,p.y,1694.5);});
 await expect.poll(async()=>(await state(page)).entryExits.state,{timeout:10000}).toBe(0);
 const floor=await page.evaluate(()=>(window as any).__game.groundAt(2496.05,1692.73,1016));
 await page.evaluate(g=>(window as any).__game.placePlayer(2496.05,g,1692.73),floor);
 await expect.poll(async()=>(await state(page)).lighting.area,{timeout:120000}).toBe(0);
 await expect.poll(async()=>(await state(page)).entryExits.loading,{timeout:60000}).toBe(false);
 const outside=await state(page);
 expect(Math.hypot(outside.player.position.x-2495.33,outside.player.position.z-1690.25)).toBeLessThan(2.1);
 expect(outside.player.position.y).toBeLessThan(20);expect(outside.entryExits.stack).toEqual([]);
 await expect.poll(async()=>(await state(page)).fadeAlpha,{timeout:10000}).toBe(0);
 expect(errors).toEqual([]);
});

// RestorePlayerStuffDuringResurrection: CJ killed in his house wakes at a Los Santos hospital in the normal world,
// the door stack empty; CGameLogic picked that hospital from outside his front door, not the interior's height.
test('dying indoors respawns CJ outside with the door stack cleared',async({page})=>{
 test.skip(!interiorsPublished,'Requires gta_int.img published with the world.');test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await atCarlsDoor(page);
 await expect.poll(async()=>(await state(page)).lighting.area,{timeout:120000}).toBe(3);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.sim.damagePlayer(1000,true));
 await expect.poll(async()=>(await state(page)).lighting.area,{timeout:60000}).toBe(0);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 const out=await state(page);
 expect(out.player.health).toBeGreaterThan(0);expect(out.entryExits.stack).toEqual([]);
 // Nowhere near the interior's hidden place above Grove Street: on the ground at a hospital.
 expect(out.player.position.y).toBeLessThan(200);
 expect(errors).toEqual([]);
});
