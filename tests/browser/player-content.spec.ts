import {test,expect} from '@playwright/test';
test('public player head and torso variants load as native skinned geometry',async({page})=>{
 const root=process.env.GTA_CONTENT_DIR;test.skip(!root,'Set GTA_CONTENT_DIR to the acquired content depot.');
 await page.goto('/models.html');const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [name,vertices] of [['head',581],['torso',405]] as const){
  await page.getByLabel('Open a .dff model',{exact:true}).setInputFiles(`${root}/player/${name}.dff`);
  await expect(page.locator('#metadata')).toContainText('Geometry 0');
  for(const index of [0,1,2]){
   await page.getByLabel('Model clump (0 = first)',{exact:true}).fill(String(index));await page.getByLabel('Model clump (0 = first)',{exact:true}).press('Backquote');
   await expect(page.locator('#warnings')).toContainText(`Clump ${index} of 3`);
   await expect(page.locator('#summary')).toContainText(String(vertices));
   await expect(page.locator('#metadata')).toContainText(['Ripped','Fat','Normal'][index]);
  }
  await page.getByLabel('Model preview').screenshot({path:`artifacts/native-player-${name}.png`});
 }
 expect(errors).toEqual([]);
});
