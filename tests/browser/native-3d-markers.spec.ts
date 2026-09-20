import {test,expect} from '@playwright/test';
// C3dMarkers: a cone placed every frame (as CEntryExitManager::Update places entry exit markers) draws diamond_3 in
// yellow, bobbing above its point.
test('a 3d marker cone draws a yellow diamond',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.setTime(12*60));
 // Six units from the player at head height, ahead and to one side, clear of CJ.
 const p=(await state()).player,h=p.heading??0,side=Math.sqrt(6**2-5**2);
 await page.evaluate(({x,y,z})=>(window as any).__game.placeMarkerCone(x,y,z),{x:p.position.x+Math.sin(h)*5-Math.cos(h)*side,y:p.position.y+1.5,z:p.position.z+Math.cos(h)*5+Math.sin(h)*side});
 await expect.poll(async()=>(await state()).markers3d.drawn,{timeout:20000}).toBe(1);
 await page.waitForTimeout(500);
 const s=await state();expect(s.markers3d.error).toBeNull();
 // 6 units from the player: 2 × (1 − 0.3 × 19 / 20), within 0.3 of its point.
 expect(s.markers3d.first.size).toBeCloseTo(1.43,2);
 expect(Math.abs(s.markers3d.first.position[2]-(p.position.y+1.5))).toBeLessThanOrEqual(.3001);
 // The marker's pixel is read without CPostEffects' colour filter, which tints the whole frame.
 await page.evaluate(()=>(window as any).__game.setColourFilter(false));await page.waitForTimeout(100);
 const center=(await state()).markers3d.center;expect(center).not.toBeNull();
 const [r,g,b]=await page.evaluate(ndc=>new Promise<number[]>(resolve=>requestAnimationFrame(()=>{
  const canvas=document.querySelector<HTMLCanvasElement>('canvas.world')!,gl=canvas.getContext('webgl2')!,pixel=new Uint8Array(4);
  gl.readPixels(Math.floor((ndc[0]+1)/2*canvas.width),Math.floor((ndc[1]+1)/2*canvas.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);resolve([...pixel]);
 })),center);
 // Yellow: the material colour (255, 255, 0) modulates the texture and the bright marker light; the cone's vertex
 // alpha falls from its tip (255) to its rim (127), so the point itself is half blended over the road.
 expect(Math.min(r,g)).toBeGreaterThan(90);expect(Math.min(r,g)-b).toBeGreaterThan(30);expect(Math.abs(r-g)).toBeLessThan(30);
 await page.screenshot({path:'artifacts/native-3d-markers.png'});
 expect(errors).toEqual([]);
});
