import {test,expect} from '@playwright/test';
import {readdirSync} from 'node:fs';
for(const region of [
 {name:'grove-street',folder:'LA',ipl:'LAe2',x:2495,y:-1687,radius:180,models:233,placements:546,preset:'grove-street'},
 {name:'mount-chiliad',folder:'country',ipl:'countryS',x:-2320,y:-1620,radius:400,models:120,placements:195},
 {name:'doherty',folder:'SF',ipl:'SFSe',x:-2020,y:-100,radius:160,models:138,placements:185},
 {name:'las-venturas',folder:'vegas',ipl:'vegasE',x:2020,y:1500,radius:160,models:139,placements:343},
 {name:'verdant-meadows',folder:'country',ipl:'countn2',x:400,y:2500,radius:300,models:93,placements:164},
 {name:'mount-chiliad-origins',preset:'mount-chiliad',folder:'country',ipl:'countryS',x:-2320,y:-1620,radius:400,models:87,placements:162,bounds:false},
 {name:'la-border',folder:'LA',ipl:'LAe2',x:2250,y:-1500,radius:125,models:136,placements:367,bounds:true,neighbor:'LAe'},
 {name:'chiliad-east',folder:'country',ipl:'countryS',x:-1750,y:-1450,radius:450,models:172,placements:328,neighbor:'countryw',preset:'chiliad-east'},
 {name:'gant-bridge',folder:'SF',ipl:'SFw',x:-2681.5,y:1850,radius:550,models:250,placements:565,neighbor:'SFn',preset:'gant-bridge'},
]){
 test(`public world content assembles and supports walking: ${region.name}`,async({page})=>{
  test.setTimeout(90000);const root=process.env.GTA_CONTENT_DIR;test.skip(!root,'Set GTA_CONTENT_DIR to the persistent audited public world directory.');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles(root+'/gta3.img');await expect(page.getByRole('status')).toContainText('directory loaded');
  const definitions=[...['generic',region.folder].flatMap(folder=>readdirSync(`${root}/ide/${folder}`).filter(n=>n.endsWith('.ide')).map(n=>`${root}/ide/${folder}/${n}`)),`${root}/ide/leveldes/levelmap.ide`,`${root}/ide/leveldes/seabed.ide`,`${root}/ide/interior/propext.ide`,`${root}/ide/txd.ide`];
  if(region.neighbor&&region.folder==='LA')for(const name of readdirSync(`${root}/ide/leveldes`)){const path=`${root}/ide/leveldes/${name}`;if(name.endsWith('.ide')&&!definitions.includes(path))definitions.push(path);}
  await page.getByLabel('Optional .ide model definitions').setInputFiles(definitions);await expect(page.locator('#ide-status')).toContainText('model associations loaded');
  await page.getByLabel('Static .ipl for streamed LODs').setInputFiles(`${root}/ipl/${region.folder}/${region.ipl}.ipl`);
  await page.getByRole('button',{name:'Select district streams',exact:true}).click();

  await page.getByLabel('Include all archived COL collections').check();await page.getByLabel('Limit scene area',{exact:true}).check();
  if(region.neighbor){
   await page.getByLabel('Neighboring district static IPLs',{exact:true}).setInputFiles(`${root}/ipl/${region.folder}/${region.neighbor}.ipl`);
   await page.getByLabel('Native center X',{exact:true}).fill(String(region.x));await page.getByLabel('Native center Y',{exact:true}).fill(String(region.y));await page.getByLabel('Area radius',{exact:true}).fill(String(region.radius));
  }else await page.getByLabel('Map region',{exact:true}).selectOption(region.preset??region.name);
  if(region.preset&&region.neighbor){await page.getByLabel('Map region',{exact:true}).selectOption(region.preset);await expect(page.getByLabel('Include terrain crossing the area boundary',{exact:true})).toBeChecked();await expect(page.locator('#scene-region-source')).toContainText(`${region.folder}/${region.neighbor}.ipl`);}
  if(!region.neighbor)await expect(page.locator('#scene-region-source')).toContainText(`${region.folder}/${region.ipl}.ipl`);
  if(!region.neighbor||region.preset)await expect(page.getByLabel('Include terrain crossing the area boundary',{exact:true})).toBeChecked();
  if(region.bounds!==undefined)await page.getByLabel('Include terrain crossing the area boundary',{exact:true}).setChecked(region.bounds);
  await expect(page.getByLabel('Native center X',{exact:true})).toHaveValue(String(region.x));await expect(page.getByLabel('Native center Y',{exact:true})).toHaveValue(String(region.y));await expect(page.getByLabel('Area radius',{exact:true})).toHaveValue(String(region.radius));
  if(region.name==='mount-chiliad-origins')await expect(page.getByLabel('Map region',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'Assemble archive scene'}).click();await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
  if(region.neighbor)await expect(page.locator('#metadata')).toContainText('district:1:');
  if(region.ipl==='countryS'){await expect(page.locator('#metadata')).toContainText('Regional timecycle modifiers (preview metadata');await expect(page.locator('#metadata')).toContainText('27.9354');}
  await expect(page.locator('#summary')).toHaveText(`${region.models} model types · ${region.placements} placements · 0 omitted placements`);
  await expect(page.getByRole('button',{name:'Walk scene',exact:true})).toBeEnabled();await page.getByLabel('Show collision overlay').uncheck();
  await page.getByLabel('Model preview').hover();await page.mouse.wheel(0,-650);await page.waitForTimeout(150);
  await page.getByLabel('Model preview').screenshot({path:`artifacts/native-${region.name}-content.png`});
  const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Walk scene',exact:true}).click();const game=await popup;
  game.on('pageerror',e=>errors.push(e.message));
  await game.getByRole('button',{name:'Walk imported scene'}).click();await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
  if(region.name==='gant-bridge'){
   // Grounded alone can pass on shoreline terrain: require the native elevated bridge deck.
   await expect.poll(()=>game.evaluate(()=>(window as any).__game.shadowReceiverProbe()?.ground?.model)).toMatch(/^(ggbrig_|gg_split)/);
   const position=await game.evaluate(()=>(window as any).__game.state().player.position);
   expect(position.y).toBeGreaterThan(40);expect(Math.abs(position.x-region.x)).toBeLessThan(20);
  }
  if(region.ipl==='countryS')await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().lighting.regionalModifiers)).toBe(1);
  const before=await game.evaluate(()=>(window as any).__game.state().player.position);await game.keyboard.down('KeyW');await game.waitForTimeout(1000);await game.keyboard.up('KeyW');
  const after=await game.evaluate(()=>(window as any).__game.state().player.position);expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeGreaterThan(.3);
  await game.screenshot({path:`artifacts/native-${region.name}-walking.png`});expect(errors).toEqual([]);
 });
}
