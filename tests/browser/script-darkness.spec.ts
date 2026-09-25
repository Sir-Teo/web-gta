import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SET_DARKNESS_EFFECT (the blackout in the RIOT and heist missions) and SET_HEATHAZE_EFFECT: CPostEffects'
 * darkness filter lays black over the frame at its alpha, 170 for -1, and resurrection's ScriptResetForEffects clears both. */
const centre=(page:Page)=>page.evaluate(()=>{const g=(window as any).__game;let sum=0;for(const x of [.3,.5,.7])for(const y of [.4,.6]){const p=g.readPixel(x,y);sum+=p[0]+p[1]+p[2];}return sum/18;});
test('the darkness filter blacks out the frame and the heat haze switch is kept',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const fx=()=>page.evaluate(()=>(window as any).__game.state().postEffects);
 await page.waitForTimeout(1000);
 const plain=await centre(page);
 await w('setDarknessEffect',true,-1);await w('setHeatHazeEffect',true);
 await expect.poll(async()=>(await fx()).darkness.visible,{timeout:8000}).toBe(true);
 expect((await fx()).darkness.alpha).toBe(170);expect((await fx()).heatHazeFX).toBe(true);
 await page.waitForTimeout(400);
 // 170/255 of black leaves a third of the frame's light.
 const dark=await centre(page);
 expect(dark).toBeLessThan(plain*.5+2);
 await w('setDarknessEffect',true,400);
 await expect.poll(async()=>(await fx()).darkness.alpha,{timeout:8000}).toBe(255);
 await w('setDarknessEffect',false,-1);
 await expect.poll(async()=>(await fx()).darkness.visible,{timeout:8000}).toBe(false);
 await page.waitForTimeout(400);
 expect(Math.abs((await centre(page))-plain)).toBeLessThan(30);
 expect(errors).toEqual([]);
});
