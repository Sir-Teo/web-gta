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
/** Android's browser offers to install the page (beforeinstallprompt, stood in for here): the menu's Add to Home screen
 * button takes the offer, and the iPhone's Share tip is not given. */
test.describe('on an Android phone',()=>{
 const {defaultBrowserType:_,...android}=devices['Pixel 7 landscape'];
 test.use({...android});
 test('the install offer is the menu\'s Add to Home screen',async({page})=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).waitFor({timeout:120000});
  const install=page.getByRole('button',{name:'Add to Home screen',exact:true});await expect(install).toBeHidden();
  await page.evaluate(()=>{const w=window as any;w.__prompted=0;
   window.dispatchEvent(Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt:async()=>{w.__prompted++;},userChoice:Promise.resolve({outcome:'accepted'})}));});
  await install.click();expect(await page.evaluate(()=>(window as any).__prompted)).toBe(1);await expect(install).toBeHidden();
  await expect(page.locator('.menu-message')).not.toContainText('Share');
  expect(errors).toEqual([]);
 });
});
