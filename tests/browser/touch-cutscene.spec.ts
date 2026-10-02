import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** While a cutscene runs the touch controls give way to a Skip button, as the iOS and Android port's do, which presses
 * the cutscene skip (Space, CCutsceneMgr::IsCutsceneSkipButtonBeingPressed); the controls come back after it. A scripted
 * scene in the widescreen bars clears them too, with Skip only while the script can skip it. */
test.use({hasTouch:true});
test('a phone skips a cutscene with the Skip button',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const controls=page.locator('.touch-controls'),skip=page.getByRole('button',{name:'Skip',exact:true});
 await expect(controls).toHaveAttribute('data-mode','foot');await expect(skip).toBeHidden();
 await page.evaluate(()=>{const c=(window as any).__game.missionForProfiling().runtime.game.cutscene;c.load('TOUCH');c.loaded();c.start();});
 await expect(controls).toHaveAttribute('data-mode','cutscene');await expect(skip).toBeVisible();
 await expect(page.locator('.touch-button.fire:not([hidden])')).toHaveCount(0);await expect(page.locator('.touch-stick-zone')).toBeHidden();
 // The script has the camera: the camera-view button goes too.
 await expect(page.getByRole('button',{name:'Camera view',exact:true})).toBeHidden();
 // Watch the skip button the script reads, each frame, while Skip is tapped.
 const seen=page.evaluate(()=>new Promise<boolean>(done=>{const world=(window as any).__game.missionForProfiling().world;let frames=0;
  const look=()=>{if(world.cutsceneSkipPressed?.())return done(true);if(++frames>240)return done(false);requestAnimationFrame(look);};look();}));
 const box=(await skip.boundingBox())!;
 for(const type of ['pointerdown','pointerup'])await page.evaluate(({type,x,y})=>document.querySelector('.touch-button.skip')!.dispatchEvent(new PointerEvent(type,{pointerId:71,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),{type,x:box.x+box.width/2,y:box.y+box.height/2});
 expect(await seen).toBe(true);
 await page.evaluate(()=>{const c=(window as any).__game.missionForProfiling().runtime.game.cutscene;c.finish();c.clear();});
 await expect(controls).toHaveAttribute('data-mode','foot');await expect(skip).toBeHidden();
 await expect(page.getByRole('button',{name:'Camera view',exact:true})).toBeVisible();
 // A scripted scene (SWITCH_WIDESCREEN on): no stick or buttons over the subtitles, and no Skip until the script sets
 // SKIP_CUTSCENE_START's label.
 // The skip label goes on one thread and comes off the same one (the active list may reorder in between).
 const scene=(widescreen:boolean,skipLabel:number|undefined)=>page.evaluate(({widescreen,skipLabel})=>{const w=window as any,r=w.__game.missionForProfiling().runtime;
  r.game.widescreenOn=widescreen;w.__skipThread??=r.active[0].thread;w.__skipThread.sceneSkipIp=skipLabel;},{widescreen,skipLabel});
 await scene(true,undefined);
 await expect(controls).toHaveAttribute('data-mode','cutscene');await expect(page.locator('.touch-stick-zone')).toBeHidden();
 await expect(page.locator('.touch-buttons .touch-button:not([hidden])')).toHaveCount(0);
 await scene(true,0);await expect(skip).toBeVisible();
 await scene(true,undefined);await expect(skip).toBeHidden();
 await scene(false,undefined);await expect(controls).toHaveAttribute('data-mode','foot');
 expect(errors).toEqual([]);
});
