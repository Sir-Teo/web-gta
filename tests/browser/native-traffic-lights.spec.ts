import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CTrafficLights::DisplayActualLight and CBrightLights: the lit lens of the nearest Ganton signal shows its phase's
// colour over the black lens, seen from down the road it faces.
test('a traffic signal lights the lens of its phase',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 // The opening holds the screen faded out under INTRO: the lens is read in free roam. Ended before INTRO's cutscenes,
 // INTRO never sets the clock, and MAIN's own setting came before it started.
 await endStoryMission(page);
 await expect.poll(async()=>(await state()).coronas.lit,{timeout:60000}).toBeGreaterThan(10);
 const light=(await page.evaluate(()=>(window as any).__game.litPlacements())).find((l:any)=>l.name==='trafficlight1');
 expect(light).toBeDefined();
 await page.evaluate(()=>(window as any).__game.setTime(22*60));
 // 22 units out along the pole's forward, level with its box (3 units to the pole's left), facing back at it.
 const x=light.position[0]+light.forward[0]*22-3,y=light.position[1]+light.forward[1]*22;
 await page.evaluate(({x,y})=>{const g=(window as any).__game;g.placePlayer(x,g.groundAt(x,-y,40),-y);},{x,y});
 await page.waitForTimeout(500);
 const p=(await state()).player.position;await page.evaluate(h=>(window as any).__game.turnPlayer(h),Math.atan2(light.position[0]-3-p.x,-light.position[1]-p.z));
 await page.waitForTimeout(3000);
 const s=await state();expect(s.brightLights.vertices).toBeGreaterThanOrEqual(12);expect(s.brightLights.center).not.toBeNull();
 // The canvas keeps no drawing buffer: a read lands after the frame's draw only when its animation frame follows the
 // game's, so it is read until one does.
 const saturation=()=>page.evaluate(ndc=>new Promise<number>(resolve=>requestAnimationFrame(()=>{
  const canvas=document.querySelector<HTMLCanvasElement>('canvas.world')!,gl=canvas.getContext('webgl2')!,pixel=new Uint8Array(4);
  gl.readPixels(Math.floor((ndc[0]+1)/2*canvas.width),Math.floor((ndc[1]+1)/2*canvas.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);resolve(Math.max(pixel[0],pixel[1],pixel[2])-Math.min(pixel[0],pixel[1],pixel[2]));
 })),s.brightLights.center);
 // Green, yellow or red at half alpha over the black lens.
 await expect.poll(saturation,{timeout:10000}).toBeGreaterThan(50);
 await page.screenshot({path:'artifacts/native-traffic-lights.png'});
 expect(errors).toEqual([]);
});
