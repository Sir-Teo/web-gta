import {test,expect} from '@playwright/test';
/** Alt walks and Ctrl fires, as in SA's PC controls. The browser's own Alt and Ctrl shortcuts (the menu bar, back a
 * page, the address bar, find, save, bookmark, reload) must not fire while they are held in play. */
test('the game keeps Alt and Ctrl combinations from the browser',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game?.state().player.grounded),{timeout:60000}).toBe(true);
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 // Record whether the page let each keydown/keyup through to the browser, after the game's own listeners ran.
 await page.evaluate(()=>{(window as any).__keys=[];for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{const k=e as KeyboardEvent;(window as any).__keys.push({type,code:k.code,prevented:k.defaultPrevented});});});
 const combos=['Alt+KeyD','Alt+ArrowLeft','Alt+KeyF','Control+KeyS','Control+KeyD','Control+KeyF','Control+KeyR'];
 for(const combo of combos)await page.keyboard.press(combo);
 await page.keyboard.press('Alt');
 const keys:{type:string;code:string;prevented:boolean}[]=await page.evaluate(()=>(window as any).__keys);
 const downs=keys.filter(k=>k.type==='keydown');
 expect(downs.length).toBe(combos.length*2+1);
 expect(downs.filter(k=>!k.prevented)).toEqual([]);
 expect(keys.filter(k=>k.type==='keyup'&&k.code.startsWith('Alt')).every(k=>k.prevented)).toBe(true);
 // Ordinary keys stay ordinary: W is not held back from anything.
 await page.evaluate(()=>{(window as any).__keys=[];});await page.keyboard.press('KeyW');
 expect(await page.evaluate(()=>(window as any).__keys.find((k:any)=>k.type==='keydown').prevented)).toBe(false);
 expect(page.url()).toMatch(/127\.0\.0\.1:\d+\/$/);
 expect(errors).toEqual([]);
});
