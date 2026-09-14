import {test,expect} from '@playwright/test';
test('native path overlay follows real district geometry and releases data on region changes',async({page})=>{
 test.setTimeout(90000);const root=process.env.GTA_CONTENT_DIR;test.skip(!root,'Set GTA_CONTENT_DIR to the native content depot.');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const toggle=page.getByLabel('Show native paths',{exact:true});await expect(toggle).toBeDisabled();
 await page.getByLabel('Local content folder',{exact:true}).setInputFiles(root!);
 const state=()=>page.evaluate(()=>(window as any).__modelPreview.state());
 for(const region of ['grove-street','sherman-dam']){
  await page.getByLabel('Map region',{exact:true}).selectOption(region);await page.getByRole('button',{name:'Load region from folder',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
  await expect(toggle).not.toBeChecked();expect((await state()).paths).toEqual({visible:false,segments:0});
  await page.getByLabel('Show collision overlay').uncheck();const base=await state();
  await toggle.check();await expect(page.locator('#preview-path-status')).toContainText('64/64 areas · 0 unresolved links');
  await expect(page.locator('#preview-path-status')).toContainText(region==='grove-street'?'66 one-way arrows':'15 one-way arrows');
  const visible=await state();expect(visible.paths.visible).toBe(true);expect(visible.paths.segments).toBeGreaterThan(100);expect(visible.lines-base.lines).toBe(visible.paths.segments+(region==='grove-street'?66:15)*2);
  expect(visible.camera).toEqual(base.camera);expect(visible.lod).toEqual(base.lod);
  await page.getByLabel('Model preview').hover();await page.mouse.wheel(0,-450);
  await page.getByLabel('Model preview').screenshot({path:`artifacts/native-${region}-paths.png`});
  await toggle.uncheck();const hidden=await state();expect(hidden.paths.visible).toBe(false);expect(hidden.memory).toEqual(visible.memory);
  await toggle.check();expect((await state()).memory).toEqual(visible.memory);
 }
 await page.getByRole('button',{name:'Clear / cancel',exact:true}).click();
 await expect(toggle).toBeDisabled();expect((await state()).paths).toEqual({visible:false,segments:0});
 expect((await state()).memory.geometries).toBe(0);expect(errors).toEqual([]);
});
