import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The Display settings' Subtitles (FrontEndMenuManager.m_bShowSubtitles, the PC's and the mobile ports' option, on by
 * default): switched off on the pause menu's Display page, the game's scripts read it off (ARE_SUBTITLES_SWITCHED_ON, and
 * the ~z~ lines they print are dropped) and it is kept for the next visit. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('a phone switches subtitles off on the Display page, and the game hears it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const shown=()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.showSubtitles as boolean);
 await expect.poll(shown).toBe(true);
 await page.locator('.touch-button.pause').dispatchEvent('pointerdown',{pointerType:'touch'});
 await page.getByRole('button',{name:'Display',exact:true}).tap();
 const subtitles=page.getByLabel('Subtitles',{exact:true});await expect(subtitles).toBeChecked();
 await subtitles.uncheck();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('grove-display-v1')!))).toMatchObject({subtitles:false});
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 await expect.poll(shown,{timeout:10000}).toBe(false);
 // Kept for the next visit.
 await page.reload();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grove-display-v1')!).subtitles)).toBe(false);
 await page.getByRole('button',{name:'Display',exact:true}).tap().catch(()=>{});
 await expect(page.getByLabel('Subtitles',{exact:true})).not.toBeChecked();
 expect(errors).toEqual([]);
});
