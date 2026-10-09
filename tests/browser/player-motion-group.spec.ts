import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('a fat CJ walks with fat.ifp and a muscular one with muscular.ifp, from the next rebuild of the player',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await endStoryMission(page);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()?.runtime),{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).nativeCharacter?.motionGroup,{timeout:30000}).toBe('player');
 // STAT_FAT past 500 changes nothing until the player is rebuilt (a restart or an entry-exit transfer).
 await page.evaluate(()=>{const g=(window as any).__game;g.missionForProfiling().runtime.game.stats.increment(21,600);});
 await page.waitForTimeout(500);expect((await state()).nativeCharacter.motionGroup).toBe('player');
 await page.evaluate(()=>(window as any).__game.rebuildPlayerIfNeeded());
 await expect.poll(async()=>(await state()).nativeCharacter.motionGroup,{timeout:30000}).toBe('fat');
 // Walking plays the fat walk's root motion.
 await page.keyboard.down('KeyW');await page.waitForTimeout(1500);await page.screenshot({path:'artifacts/player-motion-fat.png'});
 const walking=await state();await page.keyboard.up('KeyW');
 expect(walking.player.speed).toBeGreaterThan(0);
 // Muscle past the fat: GetPlayerMotionGroupToLoad takes the fat group only while fat outweighs the muscle.
 await page.evaluate(()=>{const g=(window as any).__game;g.missionForProfiling().runtime.game.stats.increment(23,800);g.rebuildPlayerIfNeeded();});
 await expect.poll(async()=>(await state()).nativeCharacter.motionGroup,{timeout:30000}).toBe('muscular');
 await page.evaluate(()=>{const g=(window as any).__game,s=g.missionForProfiling().runtime.game.stats;s.decrement(21,s.get(21));s.decrement(23,s.get(23));g.rebuildPlayerIfNeeded();});
 await expect.poll(async()=>(await state()).nativeCharacter.motionGroup,{timeout:30000}).toBe('player');
 expect(errors).toEqual([]);
});
