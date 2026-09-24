import {test,expect} from '@playwright/test';

test('big messages queue, the reward line keeps its own 6 s, and both wait while the game is paused',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.state())).player.grounded,{timeout:90000}).toBe(true);
 const big=page.locator('.big-message');
 await page.evaluate(()=>{const h=(window as any).__game.hud();h.bigMessage('FIRST','REWARD $10',2000,3500,true);h.bigMessage('SECOND','',2000,2000,true);});
 await expect(big.locator('b')).toHaveText('FIRST');await expect(big.locator('span')).toHaveText('REWARD $10');
 // AddBigMessageQ: the second waits for the first, then shows while the reward line runs on.
 await expect(big.locator('b')).toHaveText('SECOND',{timeout:6000});await expect(big.locator('span')).toHaveText('REWARD $10');
 await expect(big.locator('span')).toHaveText('',{timeout:6000});
 await expect(big).toBeHidden({timeout:6000});
 // Game time stops while paused: a message put up just before the pause is still there after it.
 await page.evaluate(()=>(window as any).__game.hud().bigMessage('PAUSED','',1500));
 await page.keyboard.press('Escape');await page.waitForTimeout(3000);
 await expect(big.locator('b')).toHaveText('PAUSED');
 expect(errors).toEqual([]);
});
