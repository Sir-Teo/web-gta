import {test,expect} from '@playwright/test';
/** The front end's New Game beside a saved game: it asks (FESZ_QR), and the page starts over with no save, where
 * there is no New Game to offer. */
test('New Game appears only with a saved game and starts over without it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');localStorage.setItem('web-gta.progress.v1',JSON.stringify({version:1,money:1234,savedLocation:{x:2510,y:-1680,z:13.2,heading:1,timeMinutes:600}}));});
 await page.goto('/');const play=page.getByRole('button',{name:'Explore San Andreas',exact:true});await expect(play).toBeVisible({timeout:120000});
 const newGame=page.getByRole('button',{name:'New Game',exact:true});await expect(newGame).toBeVisible();
 // Declining keeps the save.
 page.once('dialog',d=>{expect(d.message()).toContain('start a new game');void d.dismiss();});await newGame.click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('web-gta.progress.v1')!).money)).toBe(1234);
 page.once('dialog',d=>void d.accept());await Promise.all([page.waitForEvent('load'),newGame.click()]);
 await expect(play).toBeVisible({timeout:120000});await expect(newGame).toBeHidden();
 expect(await page.evaluate(()=>(window as any).__game.state().money)).not.toBe(1234);
 expect(await page.evaluate(()=>localStorage.getItem('web-gta.progress.v1'))).not.toContain('savedLocation');
 expect(errors).toEqual([]);
});
