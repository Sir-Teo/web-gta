import {test,expect} from '@playwright/test';

for(const [area,name] of [['grove-street','Grove Street']]){
 test(`packaged CJ shadow follows movement, freezes on pause and survives context recovery in ${name}`,async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`/?area=${area}`);await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
  const state=()=>page.evaluate(()=>(window as any).__game.state());
  const pixels=()=>page.evaluate(()=>(window as any).__game.shadowPixelProbe());
  await expect.poll(async()=>(await state()).nativeShadow.intensity).toBe(100);
  const start=await state();const first=await pixels();
  expect(first.changed).toBeGreaterThan(100);expect(first.brightened).toBe(0);expect(first.maxDarkening).toBeGreaterThan(0);
  await page.keyboard.down('KeyW');
  try{await expect.poll(async()=>{const p=(await state()).player.position;return Math.hypot(p.x-start.player.position.x,p.z-start.player.position.z);}).toBeGreaterThan(2);}
  finally{await page.keyboard.up('KeyW');}
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Resume game',exact:true})).toBeVisible();
  await page.waitForTimeout(100);const paused=(await state()).nativeShadow;
  await page.waitForTimeout(300);expect((await state()).nativeShadow.captureUpdates).toBe(paused.captureUpdates);
  expect(paused.captureUpdates).toBeGreaterThan(start.nativeShadow.captureUpdates);expect(paused.error).toBeNull();
  const frozen=await pixels();expect(frozen.changed).toBeGreaterThan(100);expect(frozen.brightened).toBe(0);
  await page.getByRole('button',{name:'Resume game',exact:true}).click();
  await expect.poll(async()=>(await state()).nativeShadow.captureUpdates).toBeGreaterThan(paused.captureUpdates);
  // Exercise a real WebGL loss, not a synthetic DOM event.
  await page.evaluate(()=>{
   const gl=document.querySelector<HTMLCanvasElement>('canvas.world')!.getContext('webgl2')!;
   const extension=gl.getExtension('WEBGL_lose_context');if(!extension)throw Error('WEBGL_lose_context unavailable');
   (window as any).__shadowRecovery=extension;extension.loseContext();
  });
  await expect(page.locator('.menu-message')).toContainText('Waiting for the display to recover');
  await page.evaluate(()=>(window as any).__shadowRecovery.restoreContext());
  await expect(page.locator('.menu-message')).toContainText('Display recovered');
  await page.getByRole('button',{name:'Resume game',exact:true}).click();
  await expect.poll(async()=>(await pixels()).changed).toBeGreaterThan(100);
  const restored=await pixels();expect(restored.brightened).toBe(0);expect((await state()).nativeShadow.error).toBeNull();expect(errors).toEqual([]);
  await page.screenshot({path:`artifacts/pages-shadow-${area}.png`});
  console.log(JSON.stringify({area,first,frozen,restored,shadow:(await state()).nativeShadow}));
 });
}
