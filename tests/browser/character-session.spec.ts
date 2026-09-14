import {test,expect} from '@playwright/test';
test('workshop replaces a character in the same paused game and reports a closed session',async({page})=>{
 await page.goto('/');
 const link=page.getByRole('link',{name:'Open character workshop for this session'});
 await expect(link).toBeVisible();
 await page.getByRole('button',{name:'Explore Verdant Meadows',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 await page.keyboard.press('Escape');
 const before=await page.evaluate(()=>(window as any).__game.state().player.position);
 const popup=page.waitForEvent('popup');await link.click();const workshop=await popup;
 await expect(workshop.getByRole('button',{name:'Use character in linked game',exact:true})).toBeVisible();
 await workshop.getByLabel('Open a .dff model').setInputFiles('tests/fixtures/dragonff-skin.dff');
 await expect(workshop.getByRole('status')).toHaveText('dragonff-skin.dff loaded locally.');
 await workshop.getByLabel('Optional .ifp animations').setInputFiles('tests/fixtures/animation-rig.ifp');
 await expect(workshop.locator('#animation-status')).toContainText('2 tracks bound');
 await workshop.getByLabel('Animation movement').selectOption('0');
 const install=workshop.getByRole('button',{name:'Use character in linked game',exact:true});
 for(let i=0;i<2;i++){
  await install.click();
  await expect(workshop.locator('#animation-status')).toHaveText('Character installed. Return to the linked game to play.');
  const after=await page.evaluate(()=>(window as any).__game.state());
  expect(after.player.position).toEqual(before);expect(after.paused).toBe(true);expect(after.nativeCharacter).toBeTruthy();
 }
 const rejected=await workshop.evaluate(()=>new Promise<any>((resolve,reject)=>{
  const token=new URLSearchParams(location.search).get('characterTarget');
  const channel=new BroadcastChannel(`character-session-${token}`),requestId=crypto.randomUUID();
  const timer=setTimeout(()=>{channel.close();reject(new Error('Missing rejection acknowledgement'));},3000);
  channel.onmessage=({data})=>{if(data?.requestId===requestId){clearTimeout(timer);channel.close();resolve(data);}};
  channel.postMessage({type:'character',requestId,source:{convention:'invalid'}});
 }));
 expect(rejected.type).toBe('failed');expect(rejected.error).toContain('Unknown character coordinates');
 expect(await page.evaluate(()=>(window as any).__game.state().player.position)).toEqual(before);
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.visible)).toBe(true);
 await page.close();
 await install.click();
 await expect(workshop.locator('#animation-status')).toContainText('linked game did not respond',{timeout:7000});
});
