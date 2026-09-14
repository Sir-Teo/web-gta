import {test,expect} from '@playwright/test';
test('native procedural fixture models appear in walking and stay owned across pause',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const provider=await page.context().newPage();await provider.goto('/models.html');
 await provider.evaluate(async()=>{const path='/src/assets/scenePack.ts';const {readScenePack}=await import(path);const data=await readScenePack('/tests/fixtures/native-verdant.scene.bin');const channel=new BroadcastChannel('scene-test-vegetation-fixture');channel.onmessage=({data:message})=>{if(message.type==='ready')channel.postMessage({type:'scene',...data,preferredSpawn:{x:400,z:-2500}});};(window as any).__fixtureChannel=channel;});
 await page.goto('/?sceneTest=vegetation-fixture');await page.getByRole('button',{name:'Walk imported scene',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state().nativeVegetation.procedural);
 await expect.poll(async()=>(await state())?.entities??0).toBeGreaterThan(0);
 await expect.poll(async()=>(await state())?.colliders??0).toBeGreaterThan(0);
 await page.keyboard.down('KeyW');await page.waitForTimeout(1000);await page.keyboard.up('KeyW');
 await page.keyboard.press('Escape');const before=await state();
 expect(await page.evaluate(()=>(window as any).__game.state().proceduralCollisionSources)).toBe(before.colliders);
 expect(before.pool.active).toBe(before.entities);expect(before.pool.free+before.pool.active+before.pool.detached).toBe(512);
 await page.waitForTimeout(500);expect(await state()).toEqual(before);
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 // Approach retained vegetation until it enters its native model draw band.
 await page.keyboard.down('KeyW');
 try{await expect.poll(()=>page.evaluate(()=>(window as any).__game.proceduralPixelProbe().changed),{timeout:20000}).toBeGreaterThan(20);}
 finally{await page.keyboard.up('KeyW');}
 await page.screenshot({path:'artifacts/walking-procedural.png'});
 console.log(JSON.stringify(await state()));expect(errors).toEqual([]);
});
