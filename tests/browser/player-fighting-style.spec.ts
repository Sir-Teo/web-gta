import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** GIVE_MELEE_ATTACK_TO_CHAR on the player (the gyms): his fists take the style's melee.dat combo and swing its clips
 * from its own IFP block, boxing's FightB_1 from fight_b in place of FightA_1. */
test('the player boxes after the script gives him the boxing style',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // A press can land while the fists are still being taken up; the swing is pressed until one plays.
 const punch=async()=>{for(let i=0;i<30;i++){await page.mouse.move(700,450);await page.mouse.down();await page.waitForTimeout(40);await page.mouse.up();
  for(let j=0;j<4;j++){await page.waitForTimeout(150);const r=(await state()).nativeCharacter.reaction;if(r&&/^fight/.test(r))return r;}}return null;};
 expect(await punch()).toBe('fighta_1');
 await page.waitForTimeout(1500);
 // GYMLS: GIVE_MELEE_ATTACK_TO_CHAR scplayer 5 6.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.givePedMeleeAttack(1,5,6));
 await page.waitForTimeout(3000);
 expect(await punch()).toBe('fightb_1');
 expect(errors).toEqual([]);
});
