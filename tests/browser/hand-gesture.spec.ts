import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// TASK_HAND_GESTURE as the iOS CTaskComplexSignalAtPed runs it: the ped turns to CJ, and a gang ped (Grove, type 8)
// then flashes one of GHANDS' gang signs; a civilian (type 4) turns and signs nothing.
test('a Grove ped signs at CJ, and a civilian only turns to him',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 const made=await page.evaluate(()=>{const g=(window as any).__game,a=g.missionForProfiling().adapterRef,p=g.state().player.position,h=g.sim.player.heading;
  // Both stand three units ahead of CJ, one to each side, facing away from him.
  const at=(side:number)=>({x:p.x+Math.sin(h)*3+Math.cos(h)*side,y:-(p.z+Math.cos(h)*3-Math.sin(h)*side),z:p.y});
  const grove=at(1.5),civilian=at(-1.5);
  return {grove:a.createChar(8,105,grove.x,grove.y,grove.z),civilian:a.createChar(4,7,civilian.x,civilian.y,civilian.z)};});
 const views=()=>page.evaluate(m=>{const g=(window as any).__game,mission=g.missionForProfiling(),crowd=g.pedestrians();
  const of=(h:number)=>{const e=mission.peds.entity(h),p=crowd?.people.find((q:any)=>q===e);return p?{reaction:p.view.reactionName??null}:null;};
  return {grove:of(m.grove),civilian:of(m.civilian)};},made);
 await expect.poll(async()=>{const v=await views();return !!v.grove&&!!v.civilian;},{timeout:60000}).toBe(true);
 await page.evaluate(m=>{const a=(window as any).__game.missionForProfiling().adapterRef;
  for(const h of [m.grove,m.civilian])a.givePedScriptedTask(h,{kind:'handGesture',target:1},0xa1d);},made);
 // The Grove ped's clip is one of GSIGN1 to GSIGN5 (or the left-hand forms) within the turn and the 1.5 s pause.
 let signed:string|null=null;
 await expect.poll(async()=>{const r=(await views()).grove?.reaction;if(r&&/^gsign[1-5](lh)?$/i.test(r))signed=r;return signed;},{timeout:20000}).not.toBeNull();
 // The civilian never signs.
 for(let i=0;i<6;i++){expect((await views()).civilian?.reaction??'').not.toMatch(/^gsign/i);await page.waitForTimeout(500);}
 expect(errors).toEqual([]);
});
