import {test,expect} from '@playwright/test';
/** CCheckpoints: a script tube draws as a C3dMarkers tube with its direction arrow, and a ring as a torus. */
test('a script checkpoint draws its tube, arrow and ring',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()),{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.state())).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game,cps=g.missionForProfiling().runtime.game.checkpoints,p=g.state().player.position;
  const at={x:p.x,y:-p.z+12,z:p.y};cps.create(0,at,{x:at.x,y:at.y+30,z:at.z},3);
  cps.create(3,{x:at.x+6,y:at.y+10,z:at.z+4},{x:at.x+6,y:at.y+40,z:at.z+4},3);});
 const state=()=>page.evaluate(()=>(window as any).__game.state().markers3d);
 await expect.poll(async()=>(await state()).drawn,{timeout:5000}).toBe(2);
 expect((await state()).arrows).toBe(1);expect((await state()).error).toBeNull();
 await page.screenshot({path:'artifacts/checkpoints.png'});
 expect(errors).toEqual([]);
});
