import {test,expect,type Page} from '@playwright/test';

// CPostEffects::NightVision and InfraredVision: the goggles tint the drawn frame (32, 255, 32) and (255, 64, 255) with
// grain, after the colour filter greys its passes to 64.
const centre=(page:Page)=>page.evaluate(()=>{const g=(window as any).__game;const sum=[0,0,0];let n=0;for(const x of [.3,.5,.7])for(const y of [.4,.6]){const p=g.readPixel(x,y);sum[0]+=p[0];sum[1]+=p[1];sum[2]+=p[2];n++;}return sum.map(v=>v/n);});
test('night vision goggles green the frame and infrared goggles turn it magenta',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.waitForTimeout(1000);
 const plain=await centre(page);
 for(const [id,mode] of [[44,'nightvision'],[45,'infrared']] as const){
  await page.evaluate(id=>{const g=(window as any).__game;g.weapons().inventory.give(id,1);g.weapons().inventory.select(id);},id);
  await page.waitForTimeout(300);
  const p=(await state()).player.position;
  expect(await page.evaluate(({x,y,z})=>(window as any).__game.fireAt(x,y+1.5,z-10),p)).toBe(true);
  await expect.poll(async()=>(await state()).postEffects.vision,{timeout:8000}).toBe(mode);
  await page.waitForTimeout(400);
  const tinted=await centre(page),s=await state();
  // The passes are greyed to 64 before the extra multiplier scales them, so the channels stay equal.
  const pass=s.colourFilter.passes?.[0];expect(pass.r).toBe(pass.g);expect(pass.g).toBe(pass.b);expect(pass.r).toBeGreaterThanOrEqual(64);expect(pass.r).toBeLessThanOrEqual(128);
  if(mode==='nightvision'){expect(tinted[1]).toBeGreaterThan(tinted[0]*2);expect(tinted[1]).toBeGreaterThan(tinted[2]*2);}
  else{expect(tinted[0]).toBeGreaterThan(tinted[1]*1.5);expect(tinted[2]).toBeGreaterThan(tinted[1]*1.2);}
  await page.screenshot({path:`artifacts/native-vision-${mode}.png`});
  // Taking the goggles off (firing again) restores the plain frame.
  expect(await page.evaluate(({x,y,z})=>(window as any).__game.fireAt(x,y+1.5,z-10),p)).toBe(true);
  await expect.poll(async()=>(await state()).postEffects.vision,{timeout:8000}).toBeNull();
  await page.waitForTimeout(400);
  const restored=await centre(page);
  expect(Math.abs(restored[1]-plain[1])).toBeLessThan(40);
 }
 expect(errors).toEqual([]);
});
