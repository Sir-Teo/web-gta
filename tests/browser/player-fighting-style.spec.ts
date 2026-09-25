import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** GIVE_MELEE_ATTACK_TO_CHAR on the player (the gyms): his fists take the style's melee.dat combo and swing its clips
 * from its own IFP block, boxing's FightB_1 from fight_b in place of FightA_1. A script ped given a style fights with
 * it too. */
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
 // A script ped given the kung fu style (GYMSF's trainer) fights the player with FightC.
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+2,y:-p.z,z:p.y});});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:45000});
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.givePedMeleeAttack(h,6,6),ped);
 await expect.poll(()=>page.evaluate(h=>(window as any).__game.missionForProfiling().peds.entity(h).view.hasReaction('fightc_1'),ped),{timeout:30000}).toBe(true);
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(h,{kind:'killPedOnFoot',target:1,time:-1,flags:0,actionDelay:0,actionChance:0,mustBeOnFoot:true},0x05be),ped);
 await expect.poll(()=>page.evaluate(h=>(window as any).__game.missionForProfiling().peds.entity(h).view.reactionName??null,ped),{timeout:45000}).toMatch(/^fightc_/);
 expect(errors).toEqual([]);
});
