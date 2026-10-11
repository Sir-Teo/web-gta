import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const landstalker=(page:Page)=>page.evaluate(()=>{const c=[...(window as any).__game.fleet().cars].find((c:any)=>c.modelId===400&&!c.disposed);
 return c&&{upgrades:Object.fromEntries(c.upgrades),nitro:c.car.nitro,hydraulics:!!c.hydraulics,stereo:c.upgradedStereo};});

// What a mod shop does to the player's car through CShopping (IsValidModForVehicle and AddVehicleUpgrade, the iOS
// executable's): the parts it lists for a Landstalker, and nitro, hydraulics and the stereo fitted for real. (The parts
// are not drawn yet.)
test('a mod shop lists and fits upgrades on the player\'s Landstalker',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet()?.upgradeTables()),{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(1829.9,g.groundAt(1829.9,1858.1,20)+.05,1858.1);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:120000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.groundAt(1825.5,1858.1,20)),{timeout:120000}).toBeGreaterThan(10);
 await page.evaluate(async()=>{const g=(window as any).__game;await g.fleet().spawnScriptCar(400,{x:1825.5,y:g.groundAt(1825.5,1858.1,20),z:1858.1},0);});
 await expect.poll(()=>landstalker(page),{timeout:60000}).toBeTruthy();
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(1823.2,g.groundAt(1823.2,1858.1,20)+.05,1858.1);g.turnPlayer(Math.PI/2);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state(page)).carEntry.phase,{timeout:60000}).toBe('seated');
 const shop=(model:number,buy:boolean)=>page.evaluate(([model,buy])=>{const h=(window as any).__game.missionForProfiling().runtime.game.shopping.host;if(buy)h.addVehicleUpgrade(model);return h.isValidModForVehicle(model);},[model,buy] as const);
 // The Landstalker's own parts are listed (an exhaust, the nitro, the stereo) and the wheels of its wheel set (0: the
 // off-road wheel, the first gold one); another car's spoiler is not, nor a wheel only set 1 has.
 expect(await shop(1020,false)).toBe(true);expect(await shop(1008,false)).toBe(true);expect(await shop(1086,false)).toBe(true);
 expect(await shop(1025,false)).toBe(true);expect(await shop(1082,false)).toBe(true);
 expect(await shop(1000,false)).toBe(false);expect(await shop(1079,false)).toBe(false);
 // Twin nitro bottles: ten boosts; hydraulics; the stereo.
 await shop(1010,true);await shop(1087,true);await shop(1086,true);
 const fitted=(await landstalker(page))!;
 expect(fitted.nitro).toMatchObject({installed:true,boosts:10});expect(fitted.hydraulics).toBe(true);expect(fitted.stereo).toBe(true);
 expect(fitted.upgrades).toEqual({8:1010,9:1087,10:1086});
 // A smaller bottle takes the nitro slot.
 await shop(1009,true);expect((await landstalker(page))!.upgrades[8]).toBe(1009);expect((await landstalker(page))!.nitro.boosts).toBe(2);
 // The slots read back as GET_CURRENT_CAR_MOD's host answers them (the nitro's 8, the hydraulics' 9).
 expect(await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),c=[...(window as any).__game.fleet().cars].find((c:any)=>c.modelId===400);return [m.world.scriptVehicleUpgradeInSlot(c,8),m.world.scriptVehicleUpgradeInSlot(c,9)];})).toEqual([1009,1087]);
 // GIVE_NON_PLAYER_CAR_NITRO (STEAL2's rivals; iOS 0x1002052cc): CAutomobile::NitrousControl(1), the nitro fitted
 // with a single boost, on a car with none.
 const given=await page.evaluate(async()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  const h=m.vehicles.create(411,{x:p.x+10,y:-p.z+10,z:-100},0);
  for(let i=0;i<200&&!m.vehicles.entity(h);i++)await new Promise(r=>setTimeout(r,100));
  const before=m.vehicles.entity(h).car.nitro.installed;m.runtime.world.giveNonPlayerCarNitro(h);
  return {before,after:m.vehicles.entity(h).car.nitro};});
 expect(given.before).toBe(false);expect(given.after).toMatchObject({installed:true,boosts:1});
 expect(errors).toEqual([]);
});
