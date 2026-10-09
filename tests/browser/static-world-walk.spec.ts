import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
test('default world keeps walking across the first streamed terrain replacement',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 // MAIN turns CJ to its own start heading (SET_CHAR_HEADING scplayer 262) once the script is running: face north after it.
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // Out in Grove Street's road (the helper leaves CJ by the kerbside fences), facing west down it, and run forward: the
 // follow camera hangs on a string, so a held sideways key would circle him round it.
 await page.evaluate(()=>(window as any).__game.placePlayer(2495,13.5,1665));
 await page.waitForTimeout(800);
 await page.evaluate(()=>(window as any).__game.turnPlayer(-Math.PI/2));
 await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
 try{
  // The spawn's own window is asked for at start; the walk must move the region itself.
  await expect.poll(async()=>{const s=await state();return s.following.requests>0&&s.following.region.x!==2495;},{timeout:60000,intervals:[2000]}).toBe(true);
  await expect.poll(async()=>{const s=await state();return s.following.enabled&&s.following.pending===null;},{timeout:60000}).toBe(true);
 }finally{await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');}
 const final=await state();expect(final.following.region.x).not.toBe(2495);expect(final.importedInstances).toBeGreaterThan(0);expect(final.nativeCharacter).not.toBeNull();expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/san-andreas-streamed-walk.png'});
});
