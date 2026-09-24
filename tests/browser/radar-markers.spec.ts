import {test,expect} from '@playwright/test';
/** CRadar::Draw3dMarkers: off a mission, a contact point shown as a marker stands as the red cylinder, snapped size/20
 * below the ground (C3dMarker::UpdateZCoordinate) and drawn through C3dMarkers::Render. */
test('a contact point off a mission draws the red cylinder on the ground',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()),{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.state())).player.grounded,{timeout:60000}).toBe(true);
 // The stalled intro leaves the mission flag set; clear it and put a contact point 8 units ahead of CJ (north).
 await page.evaluate(()=>{const g=(window as any).__game,rt=g.missionForProfiling().runtime,p=g.state().player.position;
  rt.globals.setUint32(rt.game.onAMissionFlag,0,true);rt.game.radar.setCoordBlip(5,{x:p.x,y:-p.z+8,z:p.y},3);});
 const drawn=()=>page.evaluate(()=>(window as any).__game.state().markers3d);
 await expect.poll(async()=>(await drawn()).drawn,{timeout:5000}).toBe(1);
 const m=await drawn(),ground=await page.evaluate(()=>(window as any).__game.state().player.position.y);
 expect(m.error).toBeNull();expect(m.first.size).toBe(2);
 // Snapped to the ground under it, a tenth of a unit down.
 expect(Math.abs(m.first.position[2]-ground)).toBeLessThan(1.5);
 expect(errors).toEqual([]);
});
