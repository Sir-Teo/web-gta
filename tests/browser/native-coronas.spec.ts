import {test,expect} from '@playwright/test';
// CEntity::ProcessLightsForEntity and CCoronas: at night Grove Street's lampposts register their 2d effect lights,
// drawn as coronas over the lamp heads.
test('street lamps light their coronas at night',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 // The bundled start scene gets its models' 2d effects from the world archive.
 await expect.poll(async()=>(await state()).coronas.lit,{timeout:60000}).toBeGreaterThan(10);
 // CEntity::CreateEffects: the 2d effect particles of the placed models (Grove's insect swarms) run as FX systems.
 await expect.poll(async()=>(await state()).coronas.sceneFx,{timeout:10000}).toBeGreaterThan(0);
 expect((await state()).fx.active).toContain('insects');
 const pixelAt=(ndc:[number,number])=>page.evaluate(ndc=>new Promise<number[]>(resolve=>requestAnimationFrame(()=>{
  const canvas=document.querySelector<HTMLCanvasElement>('canvas.world')!,gl=canvas.getContext('webgl2')!,pixel=new Uint8Array(4);
  gl.readPixels(Math.floor((ndc[0]+1)/2*canvas.width),Math.floor((ndc[1]+1)/2*canvas.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);resolve([...pixel]);
 })),ndc);
 // By day the lamps stay dark.
 await page.evaluate(()=>(window as any).__game.setTime(12*60));await page.waitForTimeout(1000);
 expect((await state()).coronas.drawn).toBe(0);expect((await state()).coronas.pools).toBe(0);
 await page.evaluate(()=>(window as any).__game.setTime(23*60));
 // From the cul-de-sac, facing the lamppost across Grove Street at (2489.9, -1656.1).
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2482,g.groundAt(2482,1676,40),1676);});await page.waitForTimeout(500);
 {const p=(await state()).player.position;await page.evaluate(h=>(window as any).__game.turnPlayer(h),Math.atan2(2489.9-p.x,1656.1-p.z));}
 await expect.poll(async()=>(await state()).coronas.drawn,{timeout:10000}).toBeGreaterThan(0);
 // The lit lamps leave their additive shad_exp pools on the ground within 40 units.
 await expect.poll(async()=>(await state()).coronas.pools,{timeout:10000}).toBeGreaterThan(0);
 await page.waitForTimeout(1000);
 const first=(await state()).coronas.first;expect(first).not.toBeNull();
 const [r,g,b]=await pixelAt(first);
 // An orange glow (249, 145, 34 at the night sprite brightness), added over the sky.
 expect(r).toBeGreaterThan(180);expect(r).toBeGreaterThan(b+60);
 await page.screenshot({path:'artifacts/native-coronas.png'});
 // Dry roads reflect nothing; the rainy-weather cheat wets them at once and the lamps shine in the road.
 expect((await state()).coronaReflections.drawn).toBe(0);
 await page.keyboard.type('AUIFRVQS',{delay:30});
 await expect.poll(async()=>(await state()).weather.wetRoads,{timeout:10000}).toBe(1);
  await expect.poll(async()=>(await state()).coronaReflections.drawn,{timeout:10000}).toBeGreaterThan(0);
 // They draw right after CRenderer::RenderRoads: the road models (IDE flag 1) come first in the opaque pass.
 expect((await page.evaluate(()=>(window as any).__game.sceneCounts())).roads).toBeGreaterThan(0);
 await page.screenshot({path:'artifacts/native-corona-reflections.png'});
 expect(errors).toEqual([]);
});
