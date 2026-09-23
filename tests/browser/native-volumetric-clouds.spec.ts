import {test,expect} from '@playwright/test';
import {scriptClockSettled} from './scriptClock';

// CClouds::VolumetricCloudsRender: the puffy high clouds appear once the camera passes 220 units and fade out below it.
test('volumetric clouds appear at altitude and fade out near the ground',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await scriptClockSettled(page);
 await page.evaluate(()=>(window as any).__game.setTime(12*60));
 // On the ground the height fader runs the pass out altogether.
 await page.waitForTimeout(1500);
 const ground=(await state()).volumetricClouds;
 expect(ground.textured).toBe(true);expect(ground.drawn).toBe(0);expect(ground.visible).toBe(false);expect(ground.fader).toBe(255);
 // Six hundred units up the fader falls, and flying forward brings the clouds created ahead of the camera into
 // range (they are made at the draw distance plus 200, so a standing camera never reaches them).
 await page.evaluate(()=>(window as any).__game.placePlayer(2490,600,1680));
 // Standing still at altitude, the fader drains at four a time step (a second and a bit).
 await expect.poll(async()=>(await state()).volumetricClouds.fader,{timeout:30000}).toBe(0);
 const fly=()=>page.evaluate(()=>{const g=(window as any).__game,cam=g.render().camera,p=g.state().player.position;
  const d=cam.getWorldDirection(new (cam.position.constructor as any)());
  g.placePlayer(p.x+d.x*40,600,p.z+d.z*40);});
 for(let i=0;i<60&&!((await state()).volumetricClouds.drawn>0);i++){await fly();await page.waitForTimeout(100);}
 const air=(await state()).volumetricClouds;
 expect(air.drawn,JSON.stringify(air)).toBeGreaterThan(0);
 expect(air.visible).toBe(true);expect(air.fader).toBe(0);
 expect(air.used).toBeGreaterThan(0);expect(air.usedNum).toBe(180);expect(air.maxDistance).toBeLessThanOrEqual(600);
 // The grey follows the timecycle sky, well above the plain 64 of a black sky.
 expect(air.colour).toBeGreaterThan(100);
 // Flying on keeps clouds coming into range at their own alphas (36 to 128 over the sky grey).
 for(let i=0;i<6;i++){await fly();await page.waitForTimeout(120);}
 const settled=(await state()).volumetricClouds;
 expect(settled.fader,JSON.stringify(settled)).toBe(0);expect(settled.drawn).toBeGreaterThan(0);
 await page.screenshot({path:'artifacts/native-volumetric-clouds.png'});
 // Back on the ground the fader runs out again and nothing is drawn.
 await page.evaluate(()=>(window as any).__game.placePlayer(2490,13,1680));
 await expect.poll(async()=>(await state()).volumetricClouds.drawn,{timeout:15000}).toBe(0);
 expect(errors).toEqual([]);
});
