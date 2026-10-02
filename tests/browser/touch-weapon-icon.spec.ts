import {test,expect,devices} from '@playwright/test';
/** A phone's real touch on the HUD's weapon icon (through the browser's own touch handling, which leaves a click behind
 * where the finger lifts): held, it opens the arsenal, and the click does not land on the arsenal's close button, which
 * lies under the same spot. */
const {defaultBrowserType,...phone}=devices['Pixel 7 landscape'];
test.use({...phone});
test('holding the weapon icon on a phone opens the arsenal and it stays open',async({page,context})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 const box=(await page.locator('.weapon-slot').boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
 const cdp=await context.newCDPSession(page),selected=()=>page.evaluate(()=>(window as any).__game.weapons().inventory.selected as number);
 const touch=async(ms:number)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await page.waitForTimeout(ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 // A tap steps the weapon.
 const before=await selected();await touch(60);await expect.poll(selected,{timeout:5000}).not.toBe(before);
 // Held, it opens the arsenal, which is still open once the finger has lifted, and no weapon was stepped.
 const held=await selected();await touch(900);await page.waitForTimeout(500);
 await expect(page.locator('.arsenal')).toBeVisible();expect(await selected()).toBe(held);
 expect(errors).toEqual([]);
});
