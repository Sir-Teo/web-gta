import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CRope for the cranes INITIAL builds (CObject::ProcessControlLogic's RegisterRope on the arm, CRope::Update iOS
 * 0x10025d76c): the Easter Basin crane's arm hangs a 50-unit rope, half wound, with its magnet at the end. The ropes
 * did not exist, so GET_ROPE_HEIGHT_FOR_OBJECT (crane2.scm, STEAL4) was skipped and read nothing. */
test('the dock crane hangs its magnet on a rope whose height the script reads and sets',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,-1530,110,20));
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:90000});
 const arm=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return [...m.runtime.game.objects.values()].find((o:any)=>o.model==='MAGNOCRANE_03')?.handle;});
 expect(arm).toBeDefined();
 const rope=()=>page.evaluate((h:number)=>{
  const m=(window as any).__game.missionForProfiling(),r=m.ropes.find(h);if(!r)return null;
  const hook=r.hook&&m.runtime.game.objects.exists(r.hook.handle)?m.runtime.game.objects.at(r.hook.handle):undefined;
  return {type:r.type,wound:r.wound,spacing:r.spacing,top:r.segments[r.wound],end:r.segments[31],hook:hook?{model:hook.model,position:hook.position}:null,
   height:m.runtime.world.getRopeHeightForObject(h)};
 },arm!);
 await expect.poll(async()=>(await rope())?.hook?.model??null,{timeout:30000}).toBe('INDUS_MAGNET');
 await page.waitForTimeout(3000);
 const first=(await rope())!;
 expect(first.type).toBe(4);expect(first.height).toBe(.5);expect(first.wound).toBe(16);
 // The magnet hangs at the end of the rope, no further from the top than the rope unwound reaches.
 const reach=(h:{top:{x:number;y:number;z:number};hook:{position:{x:number;y:number;z:number}}|null;wound:number;spacing:number})=>
  ({gap:Math.hypot(h.hook!.position.x-h.top.x,h.hook!.position.y-h.top.y,h.hook!.position.z-h.top.z),reach:(31-h.wound)*h.spacing});
 const r1=reach(first);
 expect(r1.gap).toBeLessThan(r1.reach+.5);expect(first.hook!.position.z).toBeLessThan(first.top.z-5);
 // SET_ROPE_HEIGHT_FOR_OBJECT 0.2 lets out more of it: fewer nodes wound, the magnet lower.
 await page.evaluate((h:number)=>(window as any).__game.missionForProfiling().runtime.world.setRopeHeightForObject(h,.2),arm!);
 await page.waitForTimeout(3000);
 const second=(await rope())!;
 expect(second.height).toBeCloseTo(.2,5);expect(second.wound).toBe(6);
 expect(second.hook!.position.z).toBeLessThan(first.hook!.position.z-2);
 expect(reach(second).gap).toBeLessThan(reach(second).reach+.5);
 expect(errors).toEqual([]);
});
