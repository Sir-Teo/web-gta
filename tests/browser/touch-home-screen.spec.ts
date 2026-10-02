import {test,expect,devices} from '@playwright/test';
/** An iPhone's browser has no element fullscreen (the API is taken away here, as Safari on an iPhone has none): the menu
 * says the home screen plays the game full screen, and the game starts in the page as it is. */
const {defaultBrowserType,...phone}=devices['iPhone 13 landscape'];
test.use({...phone});
test('an iPhone is told to add the game to the home screen to play full screen',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{for(const name of ['requestFullscreen','webkitRequestFullscreen'])delete (Element.prototype as any)[name];});
 await page.goto('/');
 await expect(page.locator('.menu-message')).toContainText('Add to Home Screen',{timeout:120000});
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 expect(await page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
 expect(errors).toEqual([]);
});
