import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// CPostEffects::UnderWaterRipple: with the camera under the water surface the frame is redrawn as a swaying strip of
// the captured copy, tinted and darkened with depth.
test('diving puts the underwater ripple over the frame, surfacing removes it',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // The sea off Santa Maria: CJ swims at the surface, the camera above it.
 for(let i=0;i<40&&!(await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(560,1.5,1950);return g.state().player.swimming;}));i++)await page.waitForTimeout(400);
 await page.waitForTimeout(1000);
 expect((await state()).postEffects.underwater.active).toBe(false);
 // Hold the dive key until the camera follows CJ under.
 await page.keyboard.down('ControlLeft');
 await expect.poll(async()=>(await state()).postEffects.underwater.active,{timeout:15000}).toBe(true);
 await page.waitForTimeout(800);
 const under=(await state()).postEffects.underwater;
 expect(under.depth).toBeGreaterThan(0);expect(under.rows).toBeGreaterThan(10);expect(under.visible).toBe(true);expect(under.green).toBeGreaterThan(0);
 const probe=await page.evaluate(()=>(window as any).__game.postEffectPixelProbe(['Native underwater ripple']));
 expect(probe.quads).toBe(1);expect(probe.changed/probe.pixels).toBeGreaterThan(.3);
 await page.screenshot({path:'artifacts/native-underwater-ripple.png'});
 await page.keyboard.up('ControlLeft');
 // Surfacing: the ripple goes and s_WaterGreen resets.
 await page.keyboard.down('Space');
 await expect.poll(async()=>(await state()).postEffects.underwater.active,{timeout:20000}).toBe(false);
 await page.keyboard.up('Space');
 expect((await state()).postEffects.underwater.green).toBe(0);
 expect(errors).toEqual([]);
});
