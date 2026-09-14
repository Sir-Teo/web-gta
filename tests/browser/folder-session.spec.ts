import {test,expect} from '@playwright/test';
test('folder queries reuse metadata, recover after empty selections and reset for reselection or cancellation',async({page})=>{
 test.setTimeout(90000);const depot=process.env.GTA_CONTENT_DIR;test.skip(!depot,'Requires native content depot.');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');await page.getByLabel('Local content folder',{exact:true}).setInputFiles(depot!);
 await page.getByLabel('Find overlapping districts',{exact:true}).check();
 const builds=()=>page.evaluate(()=>(window as any).__modelPreview.state().folderIndexBuilds);
 const load=async(id:string)=>{
  await page.getByLabel('Map region',{exact:true}).selectOption(id);
  await page.getByRole('button',{name:'Load region from folder',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
 };
 await load('mount-chiliad');expect(await builds()).toBe(1);await expect(page.locator('#summary')).toHaveText('128 model types · 203 placements · 0 omitted placements');
 await load('chiliad-east');expect(await builds()).toBe(1);await expect(page.locator('#summary')).toHaveText('224 model types · 427 placements · 0 omitted placements');
 await page.getByLabel('Native center X',{exact:true}).fill('9000');await page.getByLabel('Native center Y',{exact:true}).fill('9000');
 await page.getByRole('button',{name:'Load region from folder',exact:true}).click();await expect(page.getByRole('status')).toContainText('No supplied district');
 await load('mount-chiliad');expect(await builds()).toBe(1);
 await page.getByLabel('Include terrain crossing the area boundary',{exact:true}).uncheck();
 await page.getByRole('button',{name:'Load region from folder',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');expect(await builds()).toBe(2);
 await page.getByLabel('Local content folder',{exact:true}).setInputFiles(depot!);expect(await builds()).toBe(0);
 await load('chiliad-east');expect(await builds()).toBe(1);
 // A cancelled request must not publish late data into a new selection.
 await page.getByRole('button',{name:'Load region from folder',exact:true}).click();await page.getByRole('button',{name:'Clear / cancel',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Local model cleared.');expect(await builds()).toBe(0);await expect(page.locator('#summary')).toBeEmpty();
 await page.getByLabel('Local content folder',{exact:true}).setInputFiles(depot!);await load('mount-chiliad');expect(await builds()).toBe(1);expect(errors).toEqual([]);
});
