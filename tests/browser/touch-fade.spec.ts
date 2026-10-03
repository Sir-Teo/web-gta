import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/* CHud::Draw's layer goes under DoFade: on a touch screen the HUD and the buttons, raised over the fade so they can be
 * tapped, fade with the screen, so the opening's black hold (long on a slow connection) shows the title card or a
 * Loading line alone. The pause button stays. */
test.use({hasTouch:true,viewport:{width:844,height:390}});
test('a touch screen\'s HUD and buttons go with the screen fade, all but the pause button',async({page})=>{
 test.setTimeout(240000);
 const opacity=(selector:string)=>page.evaluate(selector=>{const e=document.querySelector(selector);return e?+getComputedStyle(e).opacity:-1;},selector);
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 // The opening holds the screen black (MAIN's DO_FADE 0 0) until INTRO fades in.
 await expect.poll(()=>page.evaluate(()=>(window as any).__game?.state()?.fadeAlpha),{timeout:60000}).toBe(255);
 for(const selector of ['.game-ui .status','.native-navigation','.touch-buttons','.touch-top .camera'])await expect.poll(()=>opacity(selector),{timeout:10000,message:selector}).toBe(0);
 expect(await opacity('.touch-top .pause')).toBe(1);
 // Back with the screen.
 await endStoryMission(page);
 for(const selector of ['.game-ui .status','.native-navigation','.touch-buttons','.touch-top .camera'])await expect.poll(()=>opacity(selector),{timeout:20000,message:selector}).toBe(1);
 // A script's fade out and in takes them out and back again.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.fade(500,0,performance.now()));
 await expect.poll(()=>opacity('.touch-buttons'),{timeout:20000}).toBe(0);expect(await opacity('.touch-top .pause')).toBe(1);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.fade(500,1,performance.now()));
 await expect.poll(()=>opacity('.touch-buttons'),{timeout:20000}).toBe(1);await expect.poll(()=>opacity('.game-ui .status'),{timeout:20000}).toBe(1);
});

test('a long opening hold says it is loading, and the line goes once the story begins',async({page})=>{
 test.setTimeout(240000);
 // The story script's runtime arriving late, as a phone's connection brings it.
 await page.route('**/src/simulation/ScmMission.ts*',async route=>{await new Promise(r=>setTimeout(r,5000));await route.continue();});
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await expect(page.locator('.prompt')).toHaveText('Loading San Andreas…',{timeout:15000});
 // The hold over (INTRO under way), the line goes.
 await page.waitForFunction(()=>(window as any).__game?.missionForProfiling()?.runtime.active.some((a:any)=>a.thread.base>0&&a.thread.name==='INTRO'),undefined,{timeout:90000});
 await expect(page.locator('.prompt')).not.toHaveText('Loading San Andreas…',{timeout:10000});
});
