import {test,expect,devices} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The front end's Brief page in the pause menu: the mission text shown lately (CMessages::PreviousBriefs), oldest
 * first, the list opening scrolled to the newest at the bottom; with none, no Brief button. On a phone, where a line
 * that flashed past is easily missed. */
const {defaultBrowserType,...phone}=devices['Pixel 7 landscape'];
test.use({...phone});
test('the pause menu\'s Brief lists the mission text shown lately, newest at the bottom',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('grove-touch-v1',JSON.stringify({steering:'stick'})));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const brief=page.getByRole('button',{name:'Brief',exact:true}),pauseButton=page.getByRole('button',{name:'Pause',exact:true});
 // No briefs: no Brief.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.messages.previousBriefs.fill(undefined));
 await pauseButton.dispatchEvent('pointerdown',{pointerType:'touch'});await expect(page.getByRole('button',{name:'Resume game',exact:true})).toBeVisible();
 await expect(brief).toBeHidden();
 // A phone's menu has no Lighting (its panel takes local timecycle and texture files).
 await expect(page.getByRole('button',{name:'Controls',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Lighting',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 // Twenty lines, the game's own text (MAIN's FEH_MAP "Map", then FEH_STA "Stats" last of all), the oldest a key
 // whose text is not loaded (a mission's table gone), which is left out.
 await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling().runtime.game.messages;m.addToPreviousBriefArray('NOT_LOADED');for(let i=0;i<18;i++)m.addToPreviousBriefArray('FEH_MAP',[i,-1,-1,-1,-1,-1]);m.addToPreviousBriefArray('FEH_STA');});
 await pauseButton.dispatchEvent('pointerdown',{pointerType:'touch'});
 await brief.click();
 const panel=page.locator('.brief-panel');await expect(panel).toBeVisible();
 const lines=await panel.locator('li').allTextContents();
 expect(lines).toHaveLength(19);expect(lines[0]).toBe('Map');expect(lines.at(-1)).toBe('Stats');
 // The list overflows a phone's menu and opens at its end.
 expect(await panel.evaluate(p=>p.scrollHeight>p.clientHeight&&Math.abs(p.scrollTop+p.clientHeight-p.scrollHeight)<2)).toBe(true);
 await expect(panel.locator('li').last()).toBeInViewport();
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 expect(errors).toEqual([]);
});
