import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CClothesBuilder's blend of CJ's normal, fat and ripped bodies by his fat and muscle (the iOS executable's), put on
// the character in place when the player is rebuilt. Before, CJ kept the slim body whatever he ate.
test("a fat CJ's body widens at the next rebuild, on the same character, and slims back",async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const body=()=>page.evaluate(()=>(window as any).__game.playerBody());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:90000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()?.runtime),{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await body()).ratios,{timeout:60000}).not.toBeNull();
 await endStoryMission(page);
 // Thin and weak: the normal body alone.
 await page.evaluate(()=>{const g=(window as any).__game,s=g.missionForProfiling().runtime.game.stats;s.set(21,0);s.set(23,0);g.rebuildPlayerIfNeeded();});
 await expect.poll(async()=>(await body()).ratios,{timeout:30000}).toEqual({normal:1,fat:0,ripped:0});
 await page.waitForTimeout(500);
 const slim=(await body()).extent as number,swaps=(await state()).nativeCharacter.bodySwaps as number;
 await page.screenshot({path:'artifacts/player-body-slim.png'});
 // STAT_FAT 1000: the fat body whole, at the next rebuild, on the same character (its motion group follows too).
 await page.evaluate(()=>{const g=(window as any).__game,s=g.missionForProfiling().runtime.game.stats;s.set(21,1000);g.rebuildPlayerIfNeeded();});
 await expect.poll(async()=>(await body()).ratios,{timeout:30000}).toEqual({normal:0,fat:1,ripped:0});
 await expect.poll(async()=>(await state()).nativeCharacter.bodySwaps,{timeout:30000}).toBe(swaps+1);
 const fat=(await body()).extent as number;
 expect(fat).toBeGreaterThan(slim*1.05);
 await expect.poll(async()=>(await state()).nativeCharacter.motionGroup,{timeout:30000}).toBe('fat');
 await page.waitForTimeout(500);await page.screenshot({path:'artifacts/player-body-fat.png'});
 // Slim again.
 await page.evaluate(()=>{const g=(window as any).__game,s=g.missionForProfiling().runtime.game.stats;s.set(21,0);g.rebuildPlayerIfNeeded();});
 await expect.poll(async()=>(await state()).nativeCharacter.bodySwaps,{timeout:30000}).toBe(swaps+2);
 expect((await body()).extent).toBeCloseTo(slim,4);
 expect(errors).toEqual([]);
});
