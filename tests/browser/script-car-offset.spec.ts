import {test,expect} from '@playwright/test';
/** GET_OFFSET_FROM_CAR_IN_WORLD_COORDS over the car's own matrix: forward is the way the car faces, and the rows are
 * right-handed (up = right x forward), as CMatrix's are. A car set down facing north (heading 0) puts +y ahead of it. */
test('a car’s offsets are taken along the way it faces',async({page})=>{
 test.setTimeout(200000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(400,{x:p.x+8,y:-p.z+8,z:p.y},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:45000});
 await page.waitForTimeout(1000);
 const m=await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.world.vehicleMatrix(c),car);
 expect(m.forward.y).toBeGreaterThan(.95);expect(m.right.x).toBeGreaterThan(.95);expect(m.up.z).toBeGreaterThan(.95);
 const cross={x:m.right.y*m.forward.z-m.right.z*m.forward.y,y:m.right.z*m.forward.x-m.right.x*m.forward.z,z:m.right.x*m.forward.y-m.right.y*m.forward.x};
 expect(cross.x*m.up.x+cross.y*m.up.y+cross.z*m.up.z).toBeGreaterThan(.99);
 expect(errors).toEqual([]);
});
