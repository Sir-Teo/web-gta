import {expect,test} from '@playwright/test';
import {endStoryMission} from './freeRoam';
import {textureFixture,txdFixture} from '../fixtures/native-assets';
const table=()=>Array.from({length:184},(_,row)=>{const v=Array(51).fill(0);v[27]=row<8?120:300;v[28]=row<8?20:50;v[0]=64;v[1]=128;v[2]=192;v[9]=v[12]=row<8?255:0;v[11]=v[14]=row<8?0:255;return v.join(' ');}).join('\n');
test('local timecycle changes visible sky, selects weather, rejects bad replacements and clears',async({page})=>{
 test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('button',{name:'Explore San Andreas',exact:true})).toBeEnabled();
  // Look upward so native terrain cannot occlude the sampled sky pixel.
  await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click();await endStoryMission(page);
  await page.mouse.move(700,600);await page.mouse.down();await page.mouse.move(700,100,{steps:10});await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().camera.pitch)).toBeLessThan(-.15);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Lighting',exact:true}).click();
  const state=()=>page.evaluate(()=>(window as any).__game.state().lighting);
  // Read through the game's own render so the frame limiter's skipped, cleared buffers never answer; a quarter in
  // from the left near the top is clear sky.
  const pixel=()=>page.evaluate(()=>(window as any).__game.readPixel(.25,.9) as number[]);
  await page.getByLabel('Local timecycle file').setInputFiles({name:'diagnostic.dat',mimeType:'text/plain',buffer:Buffer.from(table())});
  await expect(page.locator('#lighting-status')).toContainText('loaded for this session');
  await page.getByLabel('Weather',{exact:true}).selectOption('0');
  await expect.poll(async()=>(await state()).native.top).toEqual([1,0,0]);
  // CTimeCycle interpolates in float32, so a flat 120 can come back a float step off (120.0000076).
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().camera.far)).toBeCloseTo(120,3);
  {const fog=await page.evaluate(()=>(window as any).__game.state().camera.fog);expect(fog.type).toBe('Fog');expect(fog.near).toBeCloseTo(20,3);expect(fog.far).toBeCloseTo(120,3);}
  const red=await pixel();expect(red[0]).toBeGreaterThan(245);expect(red[2]).toBeLessThan(10);
  await page.getByLabel('Weather',{exact:true}).selectOption('1');await expect.poll(async()=>(await state()).native.top).toEqual([0,0,1]);
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().camera.far)).toBeCloseTo(300,3);
  const blue=await pixel();expect(blue[2]).toBeGreaterThan(245);expect(blue[0]).toBeLessThan(10);
  await page.getByLabel('Local timecycle file').setInputFiles({name:'bad.dat',mimeType:'text/plain',buffer:Buffer.from('broken')});
  await expect(page.locator('#lighting-status')).toContainText('Current lighting retained');expect((await state()).imported).toBe('diagnostic.dat');
  await page.screenshot({path:'artifacts/local-lighting-menu.png'});
  await page.getByText('Sun texture',{exact:true}).click();
  await page.getByLabel('Local particle TXD').setInputFiles({name:'particle.txd',mimeType:'application/octet-stream',buffer:Buffer.from(txdFixture(textureFixture({name:'coronastar'}),textureFixture({name:'cloud1'})))});
  await expect(page.locator('#sun-texture-status')).toContainText('coronastar loaded');
  await expect(page.locator('#sun-texture-status')).toContainText('Low-cloud texture loaded');
  await page.getByLabel('Local particle TXD').setInputFiles({name:'bad.txd',mimeType:'application/octet-stream',buffer:Buffer.from('bad')});
  await expect(page.locator('#sun-texture-status')).toContainText('Current texture retained');
  await page.getByLabel('Local particle TXD').setInputFiles({name:'sun-only.txd',mimeType:'application/octet-stream',buffer:Buffer.from(txdFixture(textureFixture({name:'coronastar'})))});
  await expect(page.locator('#sun-texture-status')).toContainText('No cloud1 texture');
  await page.getByRole('button',{name:'Clear sun texture',exact:true}).click();await expect(page.locator('#sun-texture-status')).toContainText('Procedural sun restored');
  await page.getByRole('button',{name:'Restore scene lighting'}).click();await expect(page.locator('#lighting-status')).toContainText('Scene lighting restored');expect((await state()).native).toBeDefined();expect((await state()).imported).toBe('timecycp.dat');
  await page.getByRole('button',{name:'Resume game',exact:true}).click();await expect.poll(async()=>page.evaluate(()=>(window as any).__game.state().paused)).toBe(false);
  expect(errors).toEqual([]);
});
