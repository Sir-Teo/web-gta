import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// SLIDE_OBJECT's collision check: a script object moved onto CJ is blocked; moved where nothing stands, it is not.
test('a sliding object is blocked by CJ standing in its way',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 const made=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position,h=g.sim.player.heading;
  const x=p.x+Math.sin(h)*3,z=p.z+Math.cos(h)*3,ground=g.groundAt(x,z,p.y+2)??p.y;
  const o=m.runtime.game.objects.create('DB_AMMO',{x,y:-z,z:ground},{missionCleanup:false});
  return {handle:o.handle,me:{x:p.x,y:-p.z,z:p.y+.5},away:{x:x+Math.sin(h)*6,y:-(z+Math.cos(h)*6),z:ground}};});
 await page.waitForFunction(h=>!!(window as any).__game.scriptObjectViews()?.bodyOf(h),made.handle,{timeout:60000});
 const blocked=(to:any)=>page.evaluate(({h,to})=>(window as any).__game.missionForProfiling().adapterRef.objectBlockedAt(h,to),{h:made.handle,to});
 expect(await blocked(made.me)).toBe(true);
 expect(await blocked(made.away)).toBe(false);
 expect(errors).toEqual([]);
});
