import {test,expect} from '@playwright/test';
/** CMenuSystem: a script menu shows its title and rows from the GXT text, the pad moves its highlight (the stick
 * down on S) and Cross (sprint) accepts the highlighted row, which GET_MENU_ITEM_ACCEPTED reads. */
test('a script menu is drawn and the pad chooses from it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const id=await page.evaluate(()=>{
  const menus=(window as any).__game.missionForProfiling().runtime.game.menus;
  // MAIN's own import/export list: IE09 over IE16, IE10 and IE11, at (29, 170), 180 wide.
  const id=menus.create(0,'IE09',29,170,180,1,true,true,1);menus.insertMenu(id,0,undefined,['IE16','IE10','IE11']);return id;
 });
 const menu=page.locator('.script-menus');
 await expect(menu).toBeVisible({timeout:10000});
 await expect.poll(async()=>(await menu.locator('.script-menu-text').count()),{timeout:10000}).toBe(3);
 const title=await menu.locator('.script-menu-title').textContent();
 expect(title?.length).toBeGreaterThan(0);
 // The first row is highlighted light blue, the others night blue.
 const colours=await menu.locator('.script-menu-text').evaluateAll(els=>els.map(e=>(e as HTMLElement).style.color));
 expect(colours).toEqual(['rgb(172, 203, 241)','rgb(74, 90, 107)','rgb(74, 90, 107)']);
 // A held stick moves the highlight once (GetAnaloguePadDown wants it back near rest first), so it is held until it has.
 await page.keyboard.down('KeyS');
 await expect.poll(()=>page.evaluate(i=>(window as any).__game.missionForProfiling().runtime.game.menus.checkForSelected(i),id),{timeout:10000}).toBe(1);
 await page.waitForTimeout(500);
 expect(await page.evaluate(i=>(window as any).__game.missionForProfiling().runtime.game.menus.checkForSelected(i),id)).toBe(1);
 await page.keyboard.up('KeyS');
 await page.keyboard.down('ShiftLeft');
 await expect.poll(()=>page.evaluate(i=>(window as any).__game.missionForProfiling().runtime.game.menus.checkForAccept(i),id),{timeout:10000}).toBe(1);
 await page.keyboard.up('ShiftLeft');
 await page.evaluate(i=>(window as any).__game.missionForProfiling().runtime.game.menus.switchOff(i),id);
 await expect(menu).toBeHidden({timeout:10000});
 expect(errors).toEqual([]);
});
