import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CREATE_USER_3D_MARKER: C3dMarkers::User3dMarkerSet's cone, drawn every frame until REMOVE_USER_3D_MARKER. */
test('a script user marker is drawn until it is removed',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const drawnBefore=(await state()).markers3d.drawn;
 // HUD_COLOUR_YELLOW (14), in front of CJ at head height.
 const index=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player,h=p.heading;
  return g.missionForProfiling().runtime.world.createUser3dMarker(p.position.x+Math.sin(h)*6,-(p.position.z+Math.cos(h)*6),p.position.y+1.5,14);});
 expect(index).toBe(0);
 await expect.poll(async()=>(await state()).markers3d.drawn,{timeout:10000}).toBe(drawnBefore+1);
 await page.evaluate(i=>(window as any).__game.missionForProfiling().runtime.world.removeUser3dMarker(i),index);
 await expect.poll(async()=>(await state()).markers3d.drawn,{timeout:10000}).toBe(drawnBefore);
 expect(errors).toEqual([]);
});
