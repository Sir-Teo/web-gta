import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Buildings' alpha: two passes on the desktop (SkyGFX's PS2 dual pass), one on a touch screen, as the mobile ports'
 * shaders alpha-test with a single discard. Around Grove Street the second pass is a sixth of a frame's draws. */
const frameDraws=async(page:Page,touch:boolean)=>{
 await page.goto(touch?'/?touch=1':'/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // Facing up Grove Street, where the trees, fences and palms are cut out by their alpha.
 await page.evaluate(()=>{const r=(window as any).__game.render();r.yaw=1.6;});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().visibleImportedInstances as number),{timeout:30000}).toBeGreaterThan(100);
 await page.waitForTimeout(2000);
 return page.evaluate(async()=>{const r=(window as any).__game.render(),gl=r.renderer,orig=gl.renderBufferDirect;let all=0,second=0,cutOut=0;
  gl.renderBufferDirect=function(_c:unknown,_s:unknown,_g:unknown,m:any){all++;if(m.userData?.nativeDualHigh)second++;else if(m.transparent&&m.alphaTest>0&&m.depthWrite)cutOut++;return orig.apply(this,arguments as any);};
  await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));all=second=cutOut=0;await new Promise(res=>requestAnimationFrame(res));gl.renderBufferDirect=orig;return {all,second,cutOut};});
};
test.describe('desktop',()=>{
 test('the desktop draws buildings\' alpha in two passes',async({page})=>{
  test.setTimeout(180000);const draws=await frameDraws(page,false);
  expect(draws.second,JSON.stringify(draws)).toBeGreaterThan(20);
 });
});
test.describe('touch',()=>{
 test.use({hasTouch:true,viewport:{width:844,height:390}});
 test('a phone draws buildings\' alpha in one pass, cut out by the alpha test',async({page})=>{
  test.setTimeout(180000);const draws=await frameDraws(page,true);
  expect(draws.second,JSON.stringify(draws)).toBe(0);expect(draws.cutOut).toBeGreaterThan(20);
 });
});
