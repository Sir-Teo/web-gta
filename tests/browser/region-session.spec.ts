import {test,expect} from '@playwright/test';
test('a walk session accepts another native region and survives a rejected replacement',async({page})=>{
 test.setTimeout(90000);const depot=process.env.GTA_CONTENT_DIR;test.skip(!depot,'Requires the native content depot.');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');await page.getByLabel('Local content folder',{exact:true}).setInputFiles(depot!);
 const load=async(id:string)=>{
  await page.getByLabel('Map region',{exact:true}).selectOption(id);
  await page.getByRole('button',{name:'Load region from folder',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
 };
 await load('mount-chiliad');
 const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Walk scene',exact:true}).click();const game=await popup;
 game.on('pageerror',e=>errors.push(e.message));
 const state=()=>game.evaluate(()=>(window as any).__game.state());
 await game.getByRole('button',{name:'Walk imported scene',exact:true}).click();
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 expect((await state()).importedInstances).toBe(203);const url=game.url(),weather=(await state()).lighting.weather;
 await load('chiliad-east');await page.getByRole('button',{name:'Update terrain in walk session',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Walk session terrain updated.',{timeout:30000});
 expect(game.url()).toBe(url);expect((await state()).importedInstances).toBe(427);expect((await state()).lighting.weather).toBe(weather);
 await game.getByRole('button',{name:'Walk imported scene',exact:true}).click();
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await game.screenshot({path:'artifacts/native-session-chiliad-east.png'});
 // Exercise the receiver's failure path independently of the workshop's guards.
 await page.evaluate(token=>{const channel=new BroadcastChannel(`scene-test-${token}`);channel.postMessage({type:'replace-terrain',parts:[]});channel.close();},new URL(url).searchParams.get('sceneTest'));
 await expect(game.locator('.menu')).toContainText('The previous terrain is still available.');
 expect((await state()).importedInstances).toBe(427);
 await game.getByRole('button',{name:'Resume game',exact:true}).click();await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await load('mount-chiliad');await page.getByRole('button',{name:'Update terrain in walk session',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Walk session terrain updated.');expect((await state()).importedInstances).toBe(203);
 await game.getByRole('button',{name:'Walk imported scene',exact:true}).click();await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await game.close();expect(errors).toEqual([]);
});
