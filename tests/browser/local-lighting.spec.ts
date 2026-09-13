import {expect,test} from '@playwright/test';
const table=()=>Array.from({length:184},(_,row)=>{const v=Array(51).fill(0);v[27]=row<8?120:300;v[28]=row<8?20:50;v[0]=64;v[1]=128;v[2]=192;v[9]=v[12]=row<8?255:0;v[11]=v[14]=row<8?0:255;return v.join(' ');}).join('\n');
test('local timecycle changes visible sky, selects weather, rejects bad replacements and clears',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('button',{name:'Begin game',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Lighting',exact:true}).click();
  const state=()=>page.evaluate(()=>(window as any).__game.state().lighting);
  const pixel=()=>page.evaluate(()=>new Promise<number[]>(resolve=>requestAnimationFrame(()=>{
    const canvas=document.querySelector<HTMLCanvasElement>('canvas.world')!,gl=canvas.getContext('webgl2')!,pixel=new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width/2),Math.floor(canvas.height*.9),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);resolve([...pixel]);
  })));
  await page.getByLabel('Local timecycle file').setInputFiles({name:'diagnostic.dat',mimeType:'text/plain',buffer:Buffer.from(table())});
  await expect(page.locator('#lighting-status')).toContainText('loaded for this session');
  await expect.poll(async()=>(await state()).native.top).toEqual([1,0,0]);
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().camera.far)).toBe(120);
  expect(await page.evaluate(()=>(window as any).__game.state().camera.fog)).toMatchObject({type:"Fog",near:20,far:120});
  const red=await pixel();expect(red[0]).toBeGreaterThan(245);expect(red[2]).toBeLessThan(10);
  await page.getByLabel('Weather',{exact:true}).selectOption('1');await expect.poll(async()=>(await state()).native.top).toEqual([0,0,1]);
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().camera.far)).toBe(300);
  const blue=await pixel();expect(blue[2]).toBeGreaterThan(245);expect(blue[0]).toBeLessThan(10);
  await page.getByLabel('Local timecycle file').setInputFiles({name:'bad.dat',mimeType:'text/plain',buffer:Buffer.from('broken')});
  await expect(page.locator('#lighting-status')).toContainText('Current lighting retained');expect((await state()).imported).toBe('diagnostic.dat');
  await page.screenshot({path:'artifacts/local-lighting-menu.png'});
  await page.getByRole('button',{name:'Restore authored lighting'}).click();await expect(page.locator('#lighting-status')).toContainText('Authored lighting restored');expect((await state()).native).toBeUndefined();await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().camera.far)).toBe(650);
  await page.getByRole('button',{name:'Begin game',exact:true}).click();await expect.poll(async()=>page.evaluate(()=>(window as any).__game.state().paused)).toBe(false);
  expect(errors).toEqual([]);
});
