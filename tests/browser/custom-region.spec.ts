import {expect,test} from '@playwright/test';
test('local folder loads edited coordinates with retained district sources and walks the custom area',async({page})=>{
 test.setTimeout(90000);const root=process.env.GTA_CONTENT_DIR;test.skip(!root,'Set GTA_CONTENT_DIR to the content depot.');
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/models.html');await page.getByLabel('Local content folder',{exact:true}).setInputFiles(root!);
 const preset=page.getByLabel('Map region',{exact:true});await preset.selectOption('grove-street');
 await page.getByLabel('Native center Y',{exact:true}).fill('-1600');await page.getByLabel('Area radius',{exact:true}).fill('140');
 await expect(preset).toHaveValue('');await expect(page.locator('#scene-region-source')).toContainText('Custom area using LA/LAe2');
 await page.getByRole('button',{name:'Load region from folder',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
 await expect(page.locator('#summary')).toContainText('0 omitted placements');await expect(page.locator('#summary')).not.toContainText('542 placements');
 await expect(page.getByRole('button',{name:'Walk scene',exact:true})).toBeEnabled();
 await page.getByLabel('Show collision overlay').uncheck();
 const target=await page.evaluate(()=>(window as any).__modelPreview.state().target);expect(target[0]).toBeCloseTo(2495,0);expect(target[2]).toBeCloseTo(1600,0);
 await page.getByLabel('Model preview').screenshot({path:'artifacts/native-ganton-custom-area.png'});
 const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Walk scene',exact:true}).click();const game=await popup;game.on('pageerror',error=>errors.push(error.message));
 await game.getByRole('button',{name:'Walk imported scene',exact:true}).click();await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 const position=await game.evaluate(()=>(window as any).__game.state().player.position);expect(Math.hypot(position.x-2495,position.z-1600)).toBeLessThan(140);
 await game.screenshot({path:'artifacts/native-ganton-custom-walking.png'});await game.close();
 // Selecting the preset again restores its original coordinates and radius.
 await preset.selectOption('grove-street');await expect(page.getByLabel('Native center Y',{exact:true})).toHaveValue('-1687');await expect(page.getByLabel('Area radius',{exact:true})).toHaveValue('180');
 await page.getByLabel('Native center X',{exact:true}).fill('');await page.getByRole('button',{name:'Load region from folder',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Invalid content folder region.');
 await page.getByRole('button',{name:'Clear / cancel',exact:true}).click();await page.getByLabel('Local content folder',{exact:true}).setInputFiles(root!);
 await page.getByRole('button',{name:'Load region from folder',exact:true}).click();await expect(page.getByRole('status')).toContainText('Choose a named map region first');expect(errors).toEqual([]);
});
