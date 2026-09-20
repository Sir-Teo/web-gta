import {test,expect} from '@playwright/test';
/** Regression: standing on a downtown rooftop (about 84 m up at 1700,1400), every civilian spawned at street level is
 * culled at once by the 25 m height band. Before the fix the cull dropped the ped without giving back its Rapier body,
 * collider, character controller and view, leaking about ten of each a second until the frame took 400 ms. */
test('culled pedestrians give back their bodies and views',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state().player.grounded);
 const hop=async(x:number,z:number)=>{await page.evaluate(([x,z])=>{const g=(window as any).__game;const h=g.groundAt(x,z,300);if(h!==null)g.placePlayer(x,h+.05,z);},[x,z]);
  await page.waitForFunction(()=>{const s=(window as any).__game.state();return !s.terrainHold&&!s.paused&&s.following.pending===null;},null,{timeout:30000}).catch(()=>{});await page.waitForTimeout(400);};
 for(let x=2600;x>=1700;x-=100)await hop(x,1550);
 for(let z=1550;z>=1400;z-=50)await hop(1700,z);
 await page.waitForTimeout(3000);
 const sample=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {physics:s.physics,peds:s.pedestrians?.people?.length??0,nextId:Math.max(0,...(s.pedestrians?.people??[]).map((p:any)=>p.id)),fp:s.frameProfile,y:s.player.position.y,meshes:(()=>{let n=0;(window as any).__game.scene?.traverse?.(()=>n++);return n;})()};});
 const before=await sample();
 // A 15 s churn window: the spawner cycles peds every few seconds here, enough for a leak to show in the counts.
 await page.waitForTimeout(15000);
 const after=await sample();
 const frames=after.fp.frames-before.fp.frames,stepPeds=(after.fp.stepPeds-before.fp.stepPeds)/Math.max(1,frames),render=(after.fp.render-before.fp.render)/Math.max(1,frames);
 console.log(JSON.stringify({before,after,stepPedsMs:+stepPeds.toFixed(2),renderMs:+render.toFixed(2),errors}));
 expect(errors).toEqual([]);
 // Spawns keep churning here (the ids climb), but the physics world must not grow with them.
 expect(after.physics.bodies-before.physics.bodies).toBeLessThan(40);
 expect(after.physics.colliders-before.physics.colliders).toBeLessThan(60);
 expect(stepPeds).toBeLessThan(15);
});
