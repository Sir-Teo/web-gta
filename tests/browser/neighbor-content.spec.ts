import {expect,test} from '@playwright/test';
const regions=[
 {id:'mount-chiliad',models:128,placements:203,required:['cuntwland06b','cuntwland37_sfs','sbcs_seabit15_new']},
 {id:'las-venturas',models:139,placements:345,required:['skllsgn01_lvs','ballyring01_lvs']},
 {id:'chiliad-east',models:224,placements:427,required:['southtunnel_04_sfs','stunnel_1a_sfse','roadssfse27','sbcs_seabit17_new']},
];
for(const region of regions)test(`neighboring district content assembles and supports walking: ${region.id}`,async({page})=>{
 test.setTimeout(90000);const root=process.env.GTA_CONTENT_DIR;test.skip(!root,'Set GTA_CONTENT_DIR to the native content depot.');
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/models.html');await page.getByLabel('Local content folder',{exact:true}).setInputFiles(root!);
 await page.getByLabel('Map region',{exact:true}).selectOption(region.id);await page.getByRole('button',{name:'Load region from folder',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
 await expect(page.locator('#summary')).toHaveText(`${region.models} model types · ${region.placements} placements · 0 omitted placements`);
 for(const model of region.required)await expect(page.locator('#metadata')).toContainText(model);
 await expect(page.getByRole('button',{name:'Walk scene',exact:true})).toBeEnabled();
 await page.getByLabel('Show collision overlay').uncheck();await page.getByLabel('Model preview').screenshot({path:`artifacts/native-${region.id}-neighbor-content.png`});
 const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Walk scene',exact:true}).click();const game=await popup;game.on('pageerror',error=>errors.push(error.message));
 await game.getByRole('button',{name:'Walk imported scene',exact:true}).click();await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 expect(await game.evaluate(()=>(window as any).__game.state().importedInstances)).toBe(region.placements);
 await game.screenshot({path:`artifacts/native-${region.id}-neighbor-walking.png`});await game.close();
 await page.getByRole('button',{name:'Clear / cancel',exact:true}).click();expect(await page.evaluate(()=>(window as any).__modelPreview.state().memory.geometries)).toBe(0);expect(errors).toEqual([]);
});
