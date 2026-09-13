import {test,expect} from '@playwright/test';
// Native files are local, optional reference inputs; no downloads or bundled game data.
test('native pedestrian binds body-specific idle and walk clips',async({page})=>{
 const directory=process.env.GTA_REFERENCE_DIR;test.skip(!directory,'Set GTA_REFERENCE_DIR to the extracted native character reference.');
 const root=directory!.replace(/\/$/,'')+'/';
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');
 await page.getByLabel('Open a .dff model').setInputFiles(root+'fam1.dff');
 await expect(page.getByRole('status')).toHaveText('fam1.dff loaded locally.');
 await page.getByLabel('Optional .txd texture dictionary').setInputFiles(root+'fam1.txd');
 await expect(page.getByRole('status')).toContainText('loaded locally');
 await page.getByLabel('Optional .ifp animations').setInputFiles(root+'fat.ifp');
 await expect(page.locator('#animation-status')).toContainText('32 tracks bound');
 await page.getByRole('button',{name:'Assign idle',exact:true}).click();
 await page.getByLabel('Animation clip',{exact:true}).selectOption({label:'FatWalk'});
 await page.getByLabel('Animation movement',{exact:true}).selectOption('0');
 await page.getByRole('button',{name:'Assign walk',exact:true}).click();
 await page.getByLabel('Character coordinates',{exact:true}).selectOption('san-andreas-ped');
 await page.getByLabel('Model preview').screenshot({path:'artifacts/native-pedestrian-preview.png'});
 const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Test character in game'}).click();const game=await popup;
 game.on('pageerror',e=>errors.push(e.message));
 await expect(game.locator('.menu-message')).toContainText('Local locomotion clip ready');
 await game.getByRole('button',{name:'Begin game',exact:true}).click();
 const state=()=>game.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).nativeCharacter?.visible).toBe(true);
 const initial=await state(), start=initial.player.position;
 await game.keyboard.down('KeyW');await game.waitForTimeout(1000);await game.keyboard.up('KeyW');
 const end=await state(), dx=end.player.position.x-start.x, dz=end.player.position.z-start.z;
 expect(Math.hypot(dx,dz)).toBeGreaterThan(.5);
 expect(dx*-Math.sin(initial.camera.yaw)+dz*-Math.cos(initial.camera.yaw)).toBeGreaterThan(.5);
 await expect.poll(async()=>(await state()).nativeCharacter?.action).toBe('idle');
 await game.keyboard.down('KeyD');
 const turns=await game.evaluate(async()=>{
  const samples:any[]=[];
  for(let i=0;i<12;i++){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));samples.push((window as any).__game.state().player);}
  return samples;
 });
 await game.keyboard.up('KeyD');
 const strides=turns.map(p=>{const x=p.position.x-p.previous.x,z=p.position.z-p.previous.z,length=Math.hypot(x,z);return {length,alignment:(x*Math.sin(p.heading)+z*Math.cos(p.heading))/length};}).filter(s=>s.length>1e-5);
 expect(strides.length).toBeGreaterThan(3);
 for(const stride of strides)expect(stride.alignment).toBeGreaterThan(.95);
 await game.keyboard.down('Numpad1');
 await expect.poll(async()=>(await state()).camera.glance).toBe('behind');
 await game.locator('canvas.world').screenshot({path:'artifacts/native-pedestrian-game.png'});
 expect(errors).toEqual([]);
});
