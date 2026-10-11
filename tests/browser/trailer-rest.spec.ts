import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTrailer: a script makes a trailer as a car (CAT3's tanker, TORENO2's), and with nothing towing it the trailer stands
 * on its rear wheels and the two support legs at its front (SetupSuspensionLines, ProcessSuspension); the baggage
 * trailers stand on four wheels. The browser used to refuse every trailer, so the mission gave up at its next command. */
test('parked trailers are made and stand level on their wheels and legs',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // PETROTR (the tanker), ARTICT1, UTILTR1 and BAGBOXA, in a row on Grove Street, dropped to the ground (z -100).
 const models=[584,435,611,606];
 const handles=await page.evaluate(models=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return models.map((model:number,i:number)=>m.vehicles.create(model,{x:p.x-18+i*9,y:-p.z+14,z:-100},0));},models);
 for(const h of handles)await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
 const pose=()=>page.evaluate(hs=>hs.map((h:number)=>{const e=(window as any).__game.missionForProfiling().vehicles.entity(h),b=e.car.body,q=b.rotation(),p=b.translation(),v=b.linvel();
  return {up:1-2*(q.x*q.x+q.z*q.z),p:{x:p.x,y:p.y,z:p.z},speed:Math.hypot(v.x,v.y,v.z),legs:e.trailerLegs?.extension??null,
   drawn:e.trailerLegDrawnHeight??null,modelled:e.modelFramePoint('misc_a')?.z??null};}),handles);
 await page.waitForTimeout(3000);
 const settled=await pose();await page.waitForTimeout(1500);const later=await pose();
 settled.forEach((s,i)=>{
  // Within 5 degrees of upright, at rest, and not creeping.
  expect(s.up,`model ${models[i]}`).toBeGreaterThan(Math.cos(5*Math.PI/180));
  expect(later[i].speed,`model ${models[i]}`).toBeLessThan(.05);
  expect(Math.hypot(later[i].p.x-s.p.x,later[i].p.y-s.p.y,later[i].p.z-s.p.z),`model ${models[i]}`).toBeLessThan(.05);
 });
 // The legs are out on all but the baggage trailer, which has none.
 expect(settled.map(s=>s.legs)).toEqual([1,1,1,null]);
 // CTrailer::PreRender draws them down to the ground: the tanker's and the box trailer's frames well under where they
 // were modelled (folded up).
 for(const i of [0,1])expect(settled[i].drawn!,`model ${models[i]}`).toBeLessThan(settled[i].modelled!-.3);
 expect(settled[3].drawn).toBeNull();
 expect(errors).toEqual([]);
});
