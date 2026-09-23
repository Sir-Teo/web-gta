import {test,expect} from '@playwright/test';
/** CAudioZones is filled from Audiozon.ipl as the world loads, so SWITCH_AUDIO_ZONE has zones to switch. */
test('the audio zone table loads with the world and follows the camera',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.runtime.game.audioZones.boxes.length??0),{timeout:60000}).toBe(152);
 const out=await page.evaluate(async()=>{
  const zones=(window as any).__game.missionForProfiling().runtime.game.audioZones;
  const before=zones.spheres.map((s:any)=>s.active);
  zones.switch('LOWRIDE',true);
  // The camera in Ganton sits well outside the Unity Station sphere, so the list stays empty after an update.
  await new Promise(r=>setTimeout(r,1000));
  return {before,spheres:zones.spheres.length,lowride:zones.spheres[2].active,active:zones.activeIds};
 });
 expect(out).toEqual({before:[false,false,false],spheres:3,lowride:true,active:[]});
 expect(errors).toEqual([]);
});
