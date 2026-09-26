import {test,expect} from '@playwright/test';
/** A start package download that fails once (a busy server's 503) is tried again, and the game starts. */
test('the game starts after the start package fails to download once',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 let requests=0;
 await page.route(/\.scene\.bin(\?|$)/,route=>{requests++;return requests===1?route.fulfill({status:503,body:'busy'}):route.continue();});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:120000});
 expect(requests).toBeGreaterThanOrEqual(2);
 expect(errors).toEqual([]);
});
