import {test,expect} from '@playwright/test';
test('included native region loads and supports grounded walking without local imports',async({page})=>{
 test.setTimeout(90000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?area=verdant-meadows');
 await page.getByRole('button',{name:'Explore Verdant Meadows',exact:true}).click({timeout:60000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 const before=await page.evaluate(()=>(window as any).__game.state());
 expect(before.imported).toBe(true);expect(before.importedInstances).toBe(164);expect(before.nativeCharacter).not.toBeNull();
 await page.keyboard.down('KeyW');
 await expect.poll(async()=>{const p=await page.evaluate(()=>(window as any).__game.state().player.position);return Math.hypot(p.x-before.player.position.x,p.z-before.player.position.z);}).toBeGreaterThan(1);
 await page.keyboard.up('KeyW');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Save game',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).__game.state().paused)).toBe(false);expect(errors).toEqual([]);
});

test('retired sandbox URL opens only the native world',async({page})=>{
 test.setTimeout(90000);await page.goto('/?mode=sandbox');
 await expect(page.getByRole('button',{name:'Explore San Andreas',exact:true})).toBeVisible({timeout:60000});
 await expect(page.getByRole('link',{name:'Play the driving sandbox'})).toHaveCount(0);
 await expect(page.locator('#save, #continue, #import, #export, .radar-wrap')).toHaveCount(0);
 const state=await page.evaluate(()=>(window as any).__game.state());
 expect(state.imported).toBe(true);expect(state.importedInstances).toBe(550);expect(state.pedestrians).toEqual([]);
 await page.getByRole('button',{name:'Controls',exact:true}).click();await expect(page.locator('.controls-panel')).not.toContainText('Driving');
});

test('Grove Street starts the continuous native world at its own grounded spawn',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[],packages:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('.scene.bin'))packages.push(r.url());});
 await page.goto('/?area=grove-street');
 await expect(page.getByRole('navigation',{name:'Choose a starting point'}).getByRole('link',{name:'Grove Street',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'Explore Grove Street',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 const before=await state();expect(before.importedInstances).toBe(550);expect(before.nativeCharacter).not.toBeNull();
 expect(before.following.enabled).toBe(true);expect(before.player.position.x).toBeCloseTo(2495,0);expect(before.player.position.z).toBeCloseTo(1687,0);
 await page.keyboard.down('KeyW');
 try{await expect.poll(async()=>{const p=(await state()).player.position;return Math.hypot(p.x-before.player.position.x,p.z-before.player.position.z);}).toBeGreaterThan(2);}
 finally{await page.keyboard.up('KeyW');}
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await page.screenshot({path:'artifacts/pages-grove-street.png'});
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Resume game',exact:true})).toBeVisible();
 expect(packages).toHaveLength(1);expect(packages[0]).toContain('/play/grove.scene.bin');expect(errors).toEqual([]);
 await page.getByRole('navigation',{name:'Choose a starting point'}).getByRole('link',{name:'Verdant Meadows',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explore Verdant Meadows',exact:true})).toBeVisible({timeout:60000});
 expect((await state()).importedInstances).toBe(164);expect((await state()).following).toMatchObject({enabled:true,region:{x:400,y:2500,radius:300}});
});
