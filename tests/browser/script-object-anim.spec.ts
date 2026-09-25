import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** PLAY_OBJECT_ANIM and its questions (CRASH1's burning wall BD_FIRE1, POOL2's cue, WUZI5's katana, SYN5's rifle,
 * RIOT2's ball, DRUGS4's donut and fence): the association runs on the clump from its block, the script reads its
 * progress, and the clump's frames take the clip's pose. An atomic object takes none. */
test('a script plays an animation on an animated object and reads its progress',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,p=g.state().player.position,x=p.x+8,z=p.z,ground=g.groundAt(x,z,p.y+20)??p.y;
  const objects=g.missionForProfiling().runtime.game.objects;
  const wall=objects.create(3127,{x,y:-z,z:ground+1},{external:false,missionCleanup:false}).handle;
  const bottle=objects.create('dyn_wine_big',{x:x-4,y:-z,z:ground+.5},{external:false,missionCleanup:false}).handle;
  return {wall,bottle};
 });
 await page.waitForFunction(m=>!!(window as any).__game.scriptObjectViews()?.groupFor(m.wall),made,{timeout:60000});
 // The frames' matrices at rest, to see the pose move them.
 const frames=(h:number)=>page.evaluate(h=>{const out:number[][]=[];(window as any).__game.scriptObjectViews().groupFor(h).traverse((o:any)=>{if(Number.isInteger(o.userData.nativeFrame))out.push([...o.matrix.elements]);});return out;},h);
 const rest=await frames(made.wall);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const blocks=(fn:string)=>page.evaluate(fn=>{const b=(window as any).__game.missionForProfiling().runtime.game.animBlocks;return b[fn]('BD_FIRE');},fn);
 await blocks('request');
 await expect.poll(()=>blocks('hasLoaded'),{timeout:20000}).toBe(true);
 await w('playObjectAnim',made.wall,'BD_FIRE1','BD_FIRE',1000,false,true);
 await w('playObjectAnim',made.bottle,'BD_FIRE1','BD_FIRE',1000,false,true);
 expect(await w('objectIsPlayingAnim',made.wall,'bd_fire1')).toBe(true);
 expect(await w('objectIsPlayingAnim',made.bottle,'BD_FIRE1')).toBe(false);
 await expect.poll(()=>w('objectAnimProgress',made.wall,'BD_FIRE1'),{timeout:20000}).toBeGreaterThan(0);
 // The clip moves the wall's frames.
 await expect.poll(async()=>{const now=await frames(made.wall);return now.some((m,i)=>m.some((v,k)=>Math.abs(v-rest[i][k])>1e-3));},{timeout:20000}).toBe(true);
 // Held at a progress with the speed at nothing, the time stands.
 await w('setObjectAnimSpeed',made.wall,'BD_FIRE1',0);
 const held=await w('objectAnimProgress',made.wall,'BD_FIRE1');
 await page.waitForTimeout(800);
 expect(await w('objectAnimProgress',made.wall,'BD_FIRE1')).toBe(held);
 expect(errors).toEqual([]);
});
