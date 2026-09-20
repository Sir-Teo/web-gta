import {test,expect} from '@playwright/test';

// CCustomRoadsignMgr: the LS East sign model rdsigns4_lae05 carries a roadsign 2d effect at native (2672.93, -1085.88,
// 75.43), an overhead board reading "LS_Forum / Ocean_Docks / Palomino" over three lines, facing west.
test('an overhead road sign near the Los Santos Forum shows its 2d effect text',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).roadsigns.ready,{timeout:60000}).toBe(true);
 // Stand 27 units west of the sign, facing it, and let the terrain stream in.
 for(let i=0;i<40&&!(await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2646,78,1086);return g.groundAt(2646,1086)!=null;}));i++)await page.waitForTimeout(400);
 await expect.poll(async()=>(await state()).roadsigns.signs,{timeout:90000}).toBeGreaterThan(0);
 // The sign mesh sits at the effect's world position (the atomic's frame is never parented to the entity), with one
 // material per line, facing west (its normal along native -x).
 const sign=await page.evaluate(()=>{const g=(window as any).__game;let best:any=null;g.render().scene.traverse((o:any)=>{if(o.name!=='Native roadsign')return;o.updateWorldMatrix(true,false,true);const e=o.matrixWorld.elements,d=Math.hypot(e[12]-2672.93,e[13]-75.43,e[14]-1085.88);if(!best||d<best.d)best={d,materials:o.material.length,visible:o.visible,opacity:o.material[0].opacity,normal:[e[8],e[9],e[10]].map((v:number)=>+v.toFixed(2)||0)};});return best;});
 expect(sign,JSON.stringify(sign)).not.toBeNull();expect(sign.d).toBeLessThan(1);expect(sign.materials).toBe(3);expect(sign.visible).toBe(true);expect(sign.opacity).toBe(1);expect(sign.normal).toEqual([-1,0,0]);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2646,78,1086);g.turnPlayer(Math.PI/2);});
 await page.waitForTimeout(2000);
 expect((await state()).roadsigns.visible).toBeGreaterThan(0);
 await page.screenshot({path:'artifacts/native-roadsigns.png'});
 expect(errors).toEqual([]);
});
