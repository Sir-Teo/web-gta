import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Wasted on a phone: nothing CJ could do answers until he is back on his feet, so the touch controls give way to the
 * screen's message and fade as they do to a cutscene (the pause button stays), and come back with him at the hospital. */
test.use({hasTouch:true,isMobile:true,viewport:{width:667,height:375}});
test('a phone\'s controls give way while CJ is wasted, and come back when he is up again',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const controls=page.locator('.touch-controls'),fire=page.getByRole('button',{name:'Fire',exact:true}),pause=page.locator('.touch-button.pause');
 await expect(fire).toBeVisible();await expect(controls).toHaveAttribute('data-mode','foot');
 await page.evaluate(()=>{(window as any).__game.sim.killPlayer();});
 await expect(page.locator('.white-middle-message')).toHaveText('wasted',{timeout:60000});
 await expect(controls).toHaveAttribute('data-mode','cutscene');
 await expect(fire).toBeHidden();await expect(page.locator('.touch-stick-zone')).toBeHidden();await expect(pause).toBeVisible();
 // Up again at the hospital, the controls are back.
 await expect(controls).toHaveAttribute('data-mode','foot',{timeout:60000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.health)).toBeGreaterThan(0);
 await expect(fire).toBeVisible();
 expect(errors).toEqual([]);
});
