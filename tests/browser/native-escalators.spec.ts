import {test,expect} from '@playwright/test';

// CEscalators: the escl_LA escalator at native (1129, -1502, 18.3) in Los Santos builds its steps when the camera
// comes near and moves them along the flight.
test('a streamed escalator builds moving steps near the camera',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).escalators.ready,{timeout:60000}).toBe(true);
 // Stand by the escalator and let its model stream in (browser y is the native z, browser z the negated native y).
 for(let i=0;i<50&&!((await state()).escalators.escalators>0);i++){
  await page.evaluate(()=>(window as any).__game.placePlayer(1129,19,1502));
  await page.waitForTimeout(500);
 }
 const found=await state();
 const models=await page.evaluate(()=>((window as any).__game.state().scene?.models??[]).filter((m:string)=>/escl|vgseesc/i.test(m)));
 expect(found.escalators.escalators,JSON.stringify({e:found.escalators,models})).toBeGreaterThan(0);
 await expect.poll(async()=>(await state()).escalators.built,{timeout:20000}).toBeGreaterThan(0);
 const built=await state();
 expect(built.escalators.steps).toBeGreaterThan(5);
 expect(built.escalators.drawn).toBeGreaterThan(5);
 // The steps move: one step's position changes between frames.
 const sample=()=>page.evaluate(()=>{const g=(window as any).__game;let first:number[]|null=null;
  g.render().scene.traverse((o:any)=>{if(first||o.parent?.name!=='Native escalators')return;const e=o.matrix.elements;first=[+e[12].toFixed(3),+e[13].toFixed(3),+e[14].toFixed(3)];});
  return first;});
 const a=await sample();await page.waitForTimeout(400);const b=await sample();
 expect(a,'a step is placed').not.toBeNull();
 expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
 await page.screenshot({path:'artifacts/native-escalators.png'});
 expect(errors).toEqual([]);
 console.log(JSON.stringify({escalators:built.escalators,a,b}));
});
