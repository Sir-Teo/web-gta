import {test,expect} from '@playwright/test';
test('local content folder loads and switches authentic districts without manual file wiring',async({page})=>{
 test.setTimeout(90000);const root=process.env.GTA_CONTENT_DIR;test.skip(!root,'Set GTA_CONTENT_DIR to the acquired native depot.');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');await page.getByLabel('Local content folder',{exact:true}).setInputFiles(root!);
 for(const [preset,summary] of [['gant-bridge','266 model types · 581 placements · 0 omitted placements'],['grove-street','232 model types · 542 placements · 0 omitted placements']]){
  await page.getByLabel('Map region',{exact:true}).selectOption(preset);
  await page.getByRole('button',{name:'Load region from folder',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
  await expect(page.locator('#summary')).toHaveText(summary);await expect(page.getByRole('button',{name:'Walk scene',exact:true})).toBeEnabled();
  if(preset==='gant-bridge'){await expect(page.locator('#metadata')).toContainText('district:1:');await expect(page.locator('#metadata')).toContainText('sbseabed_sfn02');await expect(page.locator('#metadata')).toContainText('district:2:');}
  if(preset==='gant-bridge'){
   const lod=page.getByLabel('Preview distance and LOD visibility',{exact:true});
   const state=()=>page.evaluate(()=>(window as any).__modelPreview.state());
   const raw=await state();expect(raw.lod).toMatchObject({enabled:false,visible:581});
   await page.getByLabel('Show collision overlay').uncheck();
   await page.getByLabel('Model preview').screenshot({path:'artifacts/native-gant-seabed-content.png'});
   await lod.check();expect((await state()).lod.enabled).toBe(true);expect((await state()).lod.visible).toBeLessThan(581);
   await page.getByLabel('Show collision overlay').uncheck();await page.getByLabel('Model preview').hover();await page.mouse.wheel(0,-1500);
   await expect.poll(async()=>(await state()).lod.visible).toBeGreaterThan(0);
   await page.getByLabel('Model preview').screenshot({path:'artifacts/native-gant-lod-preview.png'});
   await lod.uncheck();const restored=await state();expect(restored.lod).toMatchObject({enabled:false,visible:581});expect(restored.memory).toEqual(raw.memory);
   await lod.check(); // Switching regions must release overrides and reset the control.
   const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Walk scene',exact:true}).click();const game=await popup;
   game.on('pageerror',e=>errors.push(e.message));await expect(game.getByRole('button',{name:'Walk imported scene',exact:true})).toBeVisible();
   await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().lighting.imported)).toBe('timecycp.dat');
   expect(await game.evaluate(()=>(window as any).__game.state().lighting.weather)).toBe(5);
   await expect(game.locator('#water-status')).toContainText('water.dat:');await expect(game.locator('#sun-texture-status')).toContainText('Water surface texture loaded.');
   await game.getByRole('button',{name:'Walk imported scene'}).click();await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
   await game.screenshot({path:'artifacts/native-folder-gant-environment.png'});
   await game.mouse.move(720,450);await game.mouse.down();await game.mouse.move(1150,550,{steps:8});await game.mouse.up();
   await game.screenshot({path:'artifacts/native-folder-gant-water.png'});await game.close();
  }
 }
 await expect(page.getByLabel('Preview distance and LOD visibility',{exact:true})).not.toBeChecked();
 const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Walk scene',exact:true}).click();const game=await popup;
 game.on('pageerror',e=>errors.push(e.message));await game.getByRole('button',{name:'Walk imported scene'}).click();
 await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 expect(await game.evaluate(()=>(window as any).__game.state().lighting.imported)).toBe('timecycp.dat');expect(await game.evaluate(()=>(window as any).__game.state().lighting.weather)).toBe(1);
 await expect(game.locator('#sun-texture-status')).toContainText('Low-cloud texture loaded.');
 await game.screenshot({path:'artifacts/native-folder-grove-walking.png'});
 await page.getByRole('button',{name:'Clear / cancel',exact:true}).click();
 await expect(page.getByRole('button',{name:'Frame selected area',exact:true})).toBeDisabled();
 await expect(page.getByLabel('Local content folder',{exact:true})).toHaveValue('');
 await expect(page.getByRole('button',{name:'Walk scene',exact:true})).toBeDisabled();expect(errors).toEqual([]);
});
