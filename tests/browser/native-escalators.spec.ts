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

// The step's move speed carries a ped standing on it (CPhysical's ground physical); here CJ stands on the ramp under
// the steps and is carried along the run.
test('CJ standing on a moving escalator is carried along its run',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).escalators.ready,{timeout:60000}).toBe(true);
 for(let i=0;i<50&&!((await state()).escalators.built>0);i++){await page.evaluate(()=>(window as any).__game.placePlayer(1129,19,1502));await page.waitForTimeout(500);}
 const steps:number[][]=await page.evaluate(()=>{const out:number[][]=[];(window as any).__game.render().scene.traverse((o:any)=>{if(o.parent?.name!=='Native escalators')return;const e=o.matrix.elements;out.push([e[12],e[13],e[14]]);});return out;});
 expect(steps.length).toBeGreaterThan(10);
 // A step in the middle of the first flight, and where it is a moment later: the run's direction.
 const s=steps[5];
 await page.evaluate(([x,y,z])=>(window as any).__game.placePlayer(x,z+1.2,-y),s);
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 const t0=await page.evaluate(()=>{const g=(window as any).__game.state();return {p:g.player.position,t:performance.now()};});
 await page.waitForTimeout(1500);
 const t1=await page.evaluate(()=>{const g=(window as any).__game.state();return {p:g.player.position,t:performance.now()};});
 const moved=Math.hypot(t1.p.x-t0.p.x,t1.p.z-t0.p.z),rise=t1.p.y-t0.p.y;
 // 0.016 units a frame along the slope is 0.8 a second; CJ follows it without touching the keys.
 expect(moved,JSON.stringify({t0,t1})).toBeGreaterThan(.4);expect(moved).toBeLessThan(1.6);
 // CJ rises or sinks as the step under him does.
 const stepZ=()=>page.evaluate(()=>{let z=0,i=0;(window as any).__game.render().scene.traverse((o:any)=>{if(o.parent?.name!=='Native escalators')return;if(i++===5)z=o.matrix.elements[14];});return z;});
 // A step wraps back to the start of its run now and then; the small moves between samples give the direction.
 let direction=0;for(let i=0,last=await stepZ();i<8;i++){await page.waitForTimeout(40);const z=await stepZ(),dz=z-last;last=z;if(Math.abs(dz)<.2)direction+=Math.sign(dz);}
 expect(Math.sign(rise)).toBe(Math.sign(direction));
 expect(errors).toEqual([]);
});
