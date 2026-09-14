import {test,expect} from '@playwright/test';
import {openAsBlob} from 'node:fs';
import {join} from 'node:path';
import {readImgIndex,readImgEntry} from '../../src/assets/img';

test('Greenwood DFF opens with its embedded chassis collision and releases it on replacement',async({page})=>{
 const depot=process.env.GTA_CONTENT_DIR;test.skip(!depot,'Set GTA_CONTENT_DIR for the native vehicle archive.');
 const archive=await openAsBlob(join(depot!,'gta3.img')),entries=await readImgIndex(archive as File);
 const entry=entries.find(e=>e.name==='greenwoo.dff')!,bytes=await readImgEntry(archive as File,entry);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const input=page.getByLabel('Open a .dff model');
 await input.setInputFiles({name:'greenwoo.dff',mimeType:'application/octet-stream',buffer:Buffer.from(bytes)});
 await expect(page.getByRole('status')).toHaveText('greenwoo.dff loaded locally.');
 await expect(page.locator('#metadata')).toContainText('greenwoo.dff / embedded COL');
 expect(await page.evaluate(()=>(window as any).__modelPreview.state().collisionOverlays)).toBe(1);
 const surface=page.locator('#model-canvas'),withCollision=await surface.screenshot();
 await page.locator('#show-collision').uncheck();expect((await surface.screenshot()).equals(withCollision)).toBe(false);
 await page.locator('#show-collision').check();await surface.screenshot({path:'artifacts/greenwood-embedded-collision.png'});
 await input.setInputFiles('tests/fixtures/dragonff-model.dff');
 await expect(page.getByRole('status')).toHaveText('dragonff-model.dff loaded locally.');
 expect(await page.evaluate(()=>(window as any).__modelPreview.state().collisionOverlays)).toBe(0);expect(errors).toEqual([]);
});
