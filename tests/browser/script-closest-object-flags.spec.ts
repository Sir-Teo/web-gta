import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SET_VISIBILITY_OF_CLOSEST_OBJECT_OF_TYPE (MAIN, SYN7) and SET_USES_COLLISION_OF_CLOSEST_OBJECT_OF_TYPE (SCRASH3,
 * WUZI1): the nearest entity of the model in the radius, a map placement or a script object, has bIsVisible or
 * bUsesCollision set, and a map placement keeps it while it streams in and out. */
test('a script hides the nearest object of a model and takes its collision away',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 // The nearest solid map placement to the player whose model has no other placement within 3 units.
 const prop=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position,all=g.propsNamed('.').filter((q:any)=>q.present&&q.solid);
  const d=(q:any)=>Math.hypot(q.position[0]-p.x,q.position[1]+p.z);
  return all.filter((q:any)=>!all.some((o:any)=>o!==q&&o.model===q.model&&Math.hypot(o.position[0]-q.position[0],o.position[1]-q.position[1])<3)).sort((a:any,b:any)=>d(a)-d(b))[0];});
 expect(prop).toBeTruthy();
 const [x,y,z]=prop.position;
 const solid=()=>page.evaluate(h=>(window as any).__game.propsNamed('.').find((q:any)=>q.handle===h)?.solid,prop.handle);
 await w('setUsesCollisionOfClosestObjectOfType',x+.5,y,z,3,prop.model,false);
 expect(await solid()).toBe(false);
 await w('setVisibilityOfClosestObjectOfType',x,y,z,3,prop.model,false);
 const flags=await page.evaluate(()=>(window as any).__game.scriptPlacementFlags());
 expect(flags.hidden.length).toBe(1);expect(flags.solidless.length).toBe(1);
 await w('setUsesCollisionOfClosestObjectOfType',x,y,z,3,prop.model,true);await w('setVisibilityOfClosestObjectOfType',x,y,z,3,prop.model,true);
 expect(await solid()).toBe(true);
 expect(await page.evaluate(()=>(window as any).__game.scriptPlacementFlags())).toEqual({hidden:[],solidless:[]});
 // A script object of a model nearer than any map one is the one switched.
 const me=await w('pedPosition',1);
 const box=await page.evaluate(me=>(window as any).__game.missionForProfiling().runtime.game.objects.create('cardboardbox',{x:me.x+3,y:me.y,z:me.z},{external:false,missionCleanup:false}).handle,me);
 await w('setVisibilityOfClosestObjectOfType',me.x+3,me.y,me.z,2,'cardboardbox',false);
 expect(await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.game.objects.at(h).visible,box)).toBe(false);
 // Nothing of the model in range: nothing changes.
 await w('setVisibilityOfClosestObjectOfType',me.x+50,me.y,me.z,1,'cardboardbox',true);
 expect(await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.game.objects.at(h).visible,box)).toBe(false);
 expect(errors).toEqual([]);
});
