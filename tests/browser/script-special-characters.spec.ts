import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CREATE_CHAR's model id: MODEL_SPECIAL01 on are the slots LOAD_SPECIAL_CHARACTER fills (RequestSpecialChar, slot n
 * is model 289 + n), and any other id is its peds.ide row. INTRO's Sweet, Smoke, Ryder and the Ballas are built as
 * themselves, not from the civilian roster. */
test('script peds are built from their special-character slot or their peds.ide model',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position,at=(dx:number,dy:number)=>({x:p.x+dx,y:-p.z+dy,z:p.y});
  m.runtime.game.specialCharacters.load(1,'SWEET');m.runtime.game.specialCharacters.load(3,'RYDER2');
  const car=m.vehicles.create(596,{x:p.x+8,y:-p.z+8,z:-100},0);
  return {sweet:m.peds.create(4,290,at(3,0)),ballas:m.peds.create(8,102,at(-3,0)),car,ryder:m.peds.createInCar(4,292,car,'driver')};});
 const models=async()=>page.evaluate(({sweet,ballas,ryder})=>{const m=(window as any).__game.missionForProfiling();
  const model=(h:number)=>{const e=m.peds.entity(h);return e?(e.modelRef??e.model??null):null;};
  return {sweet:model(sweet),ballas:model(ballas),ryder:model(ryder)};},made);
 await expect.poll(async()=>{const r=await models();return [r.sweet,r.ballas,r.ryder];},{timeout:60000}).toEqual(['sweet','ballas1','ryder2']);
 expect(errors).toEqual([]);
});
