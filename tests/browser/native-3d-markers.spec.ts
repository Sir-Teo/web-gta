import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
import {scriptClockSettled} from './scriptClock';
// C3dMarkers: a cone placed every frame (as CEntryExitManager::Update places entry exit markers) draws diamond_3 in
// yellow, bobbing above its point.
test('a 3d marker cone draws a yellow diamond',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await scriptClockSettled(page);await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.setTime(12*60));
 // The script turns CJ as it starts (toward the houses) without swinging the camera round: face him and the camera
 // back down the street.
 await page.evaluate(()=>(window as any).__game.turnPlayer(Math.PI));
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
 // Read through the game's own render: the frame limiter leaves most animation frames with a cleared buffer.
 // The cone bobs between the state read and the pixel read, so the tip is taken from a short run up into its body,
 // where it widens, and the most yellow of those pixels is judged.
 const [r,g,b]=await page.evaluate(ndc=>{
  const read=(dy:number)=>(window as any).__game.readPixel((ndc[0]+1)/2,(ndc[1]+1)/2+dy) as number[];
  return [0,.005,.01,.015,.02,.03].map(read).reduce((best,p)=>Math.min(p[0],p[1])-p[2]>Math.min(best[0],best[1])-best[2]?p:best);
 },center);
 // Yellow: the material colour (255, 255, 0) modulates the texture and the bright marker light; the cone's vertex
 // alpha falls from its tip (255) to its rim (127), so the point itself is half blended over the road.
 expect(Math.min(r,g)).toBeGreaterThan(70);expect(Math.min(r,g)-b).toBeGreaterThan(30);expect(Math.abs(r-g)).toBeLessThan(30);
 await page.screenshot({path:'artifacts/native-3d-markers.png'});
 expect(errors).toEqual([]);
});
