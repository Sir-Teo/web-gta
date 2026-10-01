import {test,expect} from '@playwright/test';
/* camera.scm, which MAIN starts while CJ holds the camera, runs (it was held back on SET_PHOTO_CAMERA_EFFECT): beside a
 * member of his group it offers to have his picture taken (CAM_001, PED_ANSWER_PHONE, Tab on the PC), and gives up on
 * nothing. The hand-over that follows the press is not covered here yet. */
test('beside a homie with the camera, CJ is offered his picture taken',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 // A saved game, so INTRO's opening is ended as it starts.
 await page.addInitScript(()=>{localStorage.setItem('web-gta.progress.v1',JSON.stringify({version:1,money:0,savedLocation:{x:2495,y:-1680,z:13.3,heading:1,timeMinutes:720}}));});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await page.waitForFunction(()=>((window as any).__game.missionForProfiling()?.runtime.active.length??0)>2,undefined,{timeout:60000});
 const snapshot=()=>page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),s=m.snapshot();return {threads:s.threads.map((t:any)=>String(t.name).toLowerCase()),gaveUp:s.gaveUp,help:m.runtime.game.help.message};});
 // A Grove homie in CJ's group, a step from him.
 const homie=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),a=m.adapterRef,p=a.pedPosition(1);return m.peds.create(8,'FAM1',{x:p.x+1,y:p.y,z:p.z-1});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),homie,{timeout:60000});
 await page.evaluate(h=>{const a=(window as any).__game.missionForProfiling().adapterRef;a.setGroupMember(a.getPlayerGroup(0),h);},homie);
 await page.evaluate(()=>{const w=(window as any).__game.weapons();w.inventory.give(43,36);w.inventory.select(43);});
 await expect.poll(async()=>(await snapshot()).threads,{timeout:60000}).toContain('camera');
 // Standing still beside him (within 1.5 of CJ, where a follower keeps further off), the script offers the picture.
 await expect.poll(async()=>{
  await page.evaluate(h=>{const a=(window as any).__game.missionForProfiling().adapterRef,p=a.pedPosition(1);a.setPedCoordinates(h,p.x+.8,p.y,p.z-1);},homie);
  return (await snapshot()).help;
 },{timeout:40000}).toBe('CAM_001');
 expect((await snapshot()).gaveUp).toEqual([]);
 expect(errors).toEqual([]);
});
