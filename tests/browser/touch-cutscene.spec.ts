import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** While a cutscene runs the touch controls give way to a Skip button, as the iOS and Android port's do, which presses
 * the cutscene skip (Space, CCutsceneMgr::IsCutsceneSkipButtonBeingPressed); the controls come back after it. */
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
 expect(errors).toEqual([]);
});
