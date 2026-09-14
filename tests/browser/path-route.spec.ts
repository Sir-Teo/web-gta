import {test,expect} from '@playwright/test';
test('workshop renders native route geometry and clears it on replacement, cancel and scene changes',async({page})=>{
 test.setTimeout(90000);const root=process.env.GTA_CONTENT_DIR;test.skip(!root,'Set GTA_CONTENT_DIR to the native content depot.');
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/models.html');const route=page.getByLabel('Road route destination',{exact:true}),note=page.locator('#preview-route-status');
 await expect(route).toBeDisabled();await page.getByLabel('Local content folder',{exact:true}).setInputFiles(root!);
 await page.getByLabel('Map region',{exact:true}).selectOption('grove-street');await page.getByRole('button',{name:'Load region from folder',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});await page.getByLabel('Show collision overlay').uncheck();
 const state=()=>page.evaluate(()=>(window as any).__modelPreview.state()),base=await state();const canvas=page.getByLabel('Model preview');
 const withoutRoute=await canvas.screenshot();
 await route.selectOption('santa-maria');await expect(note).toContainText('159 route segments · native length 2112 · 0 unavailable references.');
 const first=await state();expect(first.routeSegments).toBe(159);expect(first.lines-base.lines).toBe(159);expect(first.camera).toEqual(base.camera);expect(first.lod).toEqual(base.lod);
 expect((await canvas.screenshot()).equals(withoutRoute)).toBe(false);
 await canvas.screenshot({path:'artifacts/native-grove-road-route.png'});
 await route.selectOption('sherman-dam');await expect(note).toContainText('523 route segments · native length 6791');expect((await state()).memory).toEqual(first.memory);
 await route.selectOption('');await expect(note).toBeEmpty();expect((await state()).routeSegments).toBe(0);expect((await state()).memory).toEqual(base.memory);
 // Rapid replacement must not install a response from the canceled worker.
 await route.selectOption('sherman-dam');await route.selectOption('santa-maria');await expect(note).toContainText('159 route segments');expect((await state()).routeSegments).toBe(159);
 await page.getByLabel('Map region',{exact:true}).selectOption('sherman-dam');await page.getByRole('button',{name:'Load region from folder',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});await expect(route).toHaveValue('');expect((await state()).routeSegments).toBe(0);
 await route.selectOption('grove-street');await page.getByRole('button',{name:'Clear / cancel',exact:true}).click();
 await expect(route).toBeDisabled();await expect(note).toBeEmpty();expect((await state()).memory.geometries).toBe(0);expect(errors).toEqual([]);
});
