import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Commands a mission sweep found without an answer: the player's entry exit, ped-type relationships, the weapon in
 * a slot and the group size cap. */
test('the player’s entry exit, ped-type relationships and weapon slots answer the script',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const out=await page.evaluate(()=>{
  const w=(window as any).__game.missionForProfiling().runtime.world;
  // Caligula's Palace's door, as the casino missions name it.
  w.setPedHasUsedEntryExit(1,2196.0,1677.0,15);
  const name=w.getNameOfEntryExitCharUsed(1),at=w.getPositionOfEntryExitCharUsed(1);
  // ACQUAINTANCE_TYPE_PED_HATE (4): PEDTYPE_GANG1 (7) hates PEDTYPE_GANG3 (9).
  const before=w.isRelationshipSet(4,7,9);w.setRelationship(4,7,9);const set=w.isRelationshipSet(4,7,9);
  w.clearRelationship(4,7,9);const cleared=w.isRelationshipSet(4,7,9);
  // Slot 3 (index 2, the handler takes one off) holds the pistols: Explore carries the whole arsenal.
  const pistol=w.pedWeaponInSlot(1,2);
  return {name,at,before,set,cleared,pistol,max:w.maxGroupMembers()};
 });
 expect(out.name.length).toBeGreaterThan(0);expect(Math.hypot(out.at.x-2196,out.at.y-1677)).toBeLessThan(30);
 expect(out.set).toBe(true);expect(out.cleared).toBe(false);
 expect([22,23,24]).toContain(out.pistol.type);expect(out.pistol.ammo).toBeGreaterThan(0);expect(out.pistol.model).toBeGreaterThan(300);
 expect(out.max).toBeGreaterThanOrEqual(0);
 expect(errors).toEqual([]);
});
