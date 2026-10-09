import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CRadar::Draw3dMarkers: off a mission, a contact point shown as a marker stands as the red cylinder, snapped size/20
 * below the ground (C3dMarker::UpdateZCoordinate) and drawn through C3dMarkers::Render. */
test('a contact point off a mission draws the red cylinder on the ground',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()),{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.state())).player.grounded,{timeout:60000}).toBe(true);
 // Off a mission and out of INTRO's widescreen (Draw3dMarkers is not run in widescreen): a contact point 8 units north
 // of CJ, made as ADD_SPRITE_BLIP_FOR_CONTACT_POINT makes it, blip and marker.
 await endStoryMission(page);
 // (The story's own contact points round Grove Street are drawn too, so the one made here is found by its point.)
 const at=await page.evaluate(()=>{const g=(window as any).__game,rt=g.missionForProfiling().runtime,p=g.state().player.position;
  rt.game.radar.setCoordBlip(5,{x:p.x,y:-p.z+8,z:p.y},3);return {x:p.x,y:-p.z+8};});
 const mine=()=>page.evaluate(at=>{const s=(window as any).__game.state().markers3d;return {error:s.error,marker:s.list?.find((m:any)=>Math.hypot(m.position[0]-at.x,m.position[1]-at.y)<.5)};},at);
 await expect.poll(async()=>!!(await mine()).marker,{timeout:5000}).toBe(true);
 const m=await mine(),ground=await page.evaluate(()=>(window as any).__game.state().player.position.y);
 expect(m.error).toBeNull();expect(m.marker.size).toBe(2);expect(m.marker.colour.slice(0,3)).toEqual([255,0,0]);
 // Snapped to the ground under it, a tenth of a unit down.
 expect(Math.abs(m.marker.position[2]-ground)).toBeLessThan(1.5);
 expect(errors).toEqual([]);
});
