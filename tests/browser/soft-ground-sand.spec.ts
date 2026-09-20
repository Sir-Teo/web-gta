import {test,expect} from '@playwright/test';

test('a car on Santa Maria Beach sand is bogged down at rest and dragged as it drives (DoSoftGroundResistance)',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar?.occupied,{timeout:15000}).toBe(true);
 await page.waitForTimeout(800);
 // Grove Street asphalt: no sand under the wheels.
 expect((await state()).nativeCar.touchingSand).toBe(false);
 // Onto the beach south of the Santa Maria pier road. Streaming follows the driven car, so the car itself is held
 // 60 m up over the beach (re-placed at rest every 400 ms) until the SAND_BEACH faces are resident.
 const hold=()=>page.evaluate(()=>{const g=(window as any).__game;g.placeCar(420,60,1830,Math.PI/2);return g.collisionFacesOf(33,1).length>0&&g.groundAt(420,1830,55)!=null;});
 let streamed=false;
 for(let i=0;i<225&&!streamed;i++){streamed=await hold();if(!streamed)await page.waitForTimeout(400);}
 expect(streamed).toBe(true);
 // Scan the streamed beach for a SAND_BEACH (33) face wide enough for the car, then park on it.
 const spot=await page.evaluate(()=>{const g=(window as any).__game;const sand=new Set([28,29,30,31,32,33,74,75,76,77]);
  for(let r=0;r<=25;r++)for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){if(Math.max(Math.abs(i),Math.abs(j))!==r)continue;const x=420+i*4,z=1830+j*4;
   const hits=[[0,0],[2,0],[-2,0],[0,2],[0,-2]].map(([dx,dz])=>g.surfaceAt(x+dx,z+dz,60));
   if(hits.every((h:any)=>h&&sand.has(h.material)&&h.y>0.5))return {x,z,y:hits[0].y};}
  return null;});
 expect(spot).not.toBeNull();
 await page.evaluate((spot:any)=>{const g=(window as any).__game;g.placeCar(spot.x,spot.y+.8,spot.z,Math.PI/2);},spot);
 await page.waitForTimeout(1500);
 const sand=(await state()).nativeCar.touchingSand;
 expect(sand).toBe(true);
 // At rest the car counts as bogged down (planar speed under 0.3 units a step).
 expect((await state()).nativeCar.boggedDown).toBe(true);
 // Driving south along the strand still moves it, sand drag and all (a second and a half, short of the pier wall).
 await page.evaluate(()=>{const g=(window as any).__game;const s=g.state();const p=s.nativeCar.position;g.placeCar(p.x,p.y+.3,p.z,Math.PI);});
 await page.waitForTimeout(500);
 await page.keyboard.down('KeyW');await page.waitForTimeout(1500);
 const mid=(await state()).nativeCar;await page.keyboard.up('KeyW');
 expect(mid.touchingSand).toBe(true);expect(mid.gas).toBe(1);
 expect(Math.hypot(mid.velocity.x,mid.velocity.z)).toBeGreaterThan(3);
 expect(errors).toEqual([]);
});
