import {test,expect} from '@playwright/test';
test('local content folder loads and switches authentic districts without manual file wiring',async({page})=>{
 test.setTimeout(90000);const root=process.env.GTA_CONTENT_DIR;test.skip(!root,'Set GTA_CONTENT_DIR to the acquired native depot.');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');await page.getByLabel('Local content folder',{exact:true}).setInputFiles(root!);
 for(const [preset,summary] of [['gant-bridge','250 model types · 565 placements · 0 omitted placements'],['grove-street','232 model types · 542 placements · 0 omitted placements']]){
  await page.getByLabel('Map region',{exact:true}).selectOption(preset);
  await page.getByRole('button',{name:'Load region from folder',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
  await expect(page.locator('#summary')).toHaveText(summary);await expect(page.getByRole('button',{name:'Walk scene',exact:true})).toBeEnabled();
  if(preset==='gant-bridge')await expect(page.locator('#metadata')).toContainText('district:1:');
 }
 const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Walk scene',exact:true}).click();const game=await popup;
 game.on('pageerror',e=>errors.push(e.message));await game.getByRole('button',{name:'Walk imported scene'}).click();
 await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 await game.screenshot({path:'artifacts/native-folder-grove-walking.png'});
 await page.getByRole('button',{name:'Clear / cancel',exact:true}).click();
 await expect(page.getByLabel('Local content folder',{exact:true})).toHaveValue('');
 await expect(page.getByRole('button',{name:'Walk scene',exact:true})).toBeDisabled();expect(errors).toEqual([]);
});
