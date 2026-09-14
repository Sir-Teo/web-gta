import {existsSync} from 'node:fs';
import {test,expect} from '@playwright/test';
import {PLAYER_CLASSIC_FILES} from '../../src/assets/readPlayerBaseBody';
for(const variant of ['fat','normal'] as const)test(`native clothed ${variant} player installs through the workshop and keeps shoulder correction through locomotion`,async({page:entry})=>{
 test.setTimeout(90000);let page=entry;
 const root=process.env.GTA_CONTENT_DIR,reference=process.env.GTA_REFERENCE_DIR;
 const animation=variant==='normal'?`${root}/animations/ped.ifp`:`${reference}/fat.ifp`;
 test.skip(!root||!existsSync(animation),'Requires acquired native player files and matching movement IFP.');
 const clips=variant==='normal'?['IDLE_stance','WALK_player','run_player']:['FatIdle','FatWalk','FatRun'];
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 if(variant==='normal'){
  await entry.goto('/models.html');await entry.getByLabel('Local content folder',{exact:true}).setInputFiles(root!);
  await entry.getByLabel('Map region',{exact:true}).selectOption('grove-street');
  await entry.getByRole('button',{name:'Load region from folder',exact:true}).click();
  await expect(entry.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
  const imported=entry.waitForEvent('popup');await entry.getByRole('button',{name:'Walk scene',exact:true}).click();page=await imported;
  page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'Walk imported scene',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__game.state().lighting.imported)).toBe('timecycp.dat');
 }else{
  await page.goto('/');await page.getByRole('button',{name:'Begin game',exact:true}).click();
 }
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 await page.keyboard.press('Escape');
 const popup=page.waitForEvent('popup');await page.getByRole('link',{name:'Open character workshop for this session'}).click();const workshop=await popup;
 workshop.on('pageerror',e=>errors.push(e.message));
 await workshop.getByText('Assemble native CJ',{exact:true}).click();
 await workshop.getByLabel('CJ body and clothing files',{exact:true}).setInputFiles(`${root}/player/player.dff`);
 await workshop.getByRole('button',{name:'Assemble CJ',exact:true}).click();await expect(workshop.getByRole('status')).toContainText('Missing player base file: torso.dff');
 await workshop.getByLabel('CJ body and clothing files',{exact:true}).setInputFiles(PLAYER_CLASSIC_FILES.map(n=>`${root}/player/${n}`));
 await workshop.getByLabel('CJ body variant',{exact:true}).selectOption(variant);
 await workshop.getByRole('button',{name:'Assemble CJ',exact:true}).click();
 await expect(workshop.getByRole('status')).toHaveText('Native CJ assembled locally.');
 await expect(workshop.locator('#summary')).toContainText(`${variant} · classic · 1721 vertices · 2332 triangles`);
 await expect(workshop.getByLabel('Character coordinates',{exact:true})).toHaveValue('san-andreas-ped');
 await expect(workshop.getByLabel('Character coordinates',{exact:true})).toBeDisabled();
 expect(await workshop.evaluate(()=>(window as any).__modelPreview.state().playerBody)).toBe(true);
 await workshop.getByLabel('Optional .ifp animations',{exact:true}).setInputFiles(animation);
 await expect(workshop.getByLabel('Animation clip',{exact:true})).toBeEnabled();
 for(const [clip,role] of [[clips[0],'idle'],[clips[1],'walk'],[clips[2],'run']]){
  await workshop.getByLabel('Animation clip',{exact:true}).selectOption({label:clip});
  if(role!=='idle')await workshop.getByLabel('Animation movement',{exact:true}).selectOption('0');
  await workshop.getByRole('button',{name:`Assign ${role}`,exact:true}).click();
 }
 await workshop.getByLabel('Model preview').screenshot({path:`artifacts/native-cj-${variant}-workshop.png`});
 await workshop.getByRole('button',{name:'Use character in linked game',exact:true}).click();
 await expect(workshop.locator('#animation-status')).toHaveText('Character installed. Return to the linked game to play.');
 await page.bringToFront();await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.playerBody)).toBe(true);
 const before=await page.evaluate(()=>(window as any).__game.state().player.position);
 await page.keyboard.down('KeyW');await page.waitForTimeout(700);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('walk');
 await page.screenshot({path:`artifacts/native-cj-${variant}-walking.png`});
 await page.keyboard.down('ShiftLeft');await page.waitForTimeout(350);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('run');
 await page.screenshot({path:`artifacts/native-cj-${variant}-running.png`});
 await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');await page.waitForTimeout(250);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('idle');
 const after=await page.evaluate(()=>(window as any).__game.state().player.position);
 expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeGreaterThan(.3);
 await page.screenshot({path:`artifacts/native-cj-${variant}-idle.png`});
 await workshop.getByLabel('Open a .dff model',{exact:true}).setInputFiles('tests/fixtures/dragonff-skin.dff');
 await expect(workshop.getByRole('status')).toHaveText('dragonff-skin.dff loaded locally.');
 expect(await workshop.evaluate(()=>(window as any).__modelPreview.state().playerBody)).toBe(false);
 await expect(workshop.getByLabel('Character coordinates',{exact:true})).toBeEnabled();
 expect(errors).toEqual([]);await workshop.close();
});
