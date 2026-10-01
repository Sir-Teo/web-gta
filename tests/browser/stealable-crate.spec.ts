import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const crate=(page:Page,handle:number)=>page.evaluate(h=>{const o=(window as any).__game.missionForProfiling().runtime.game.objects.at(h);return {held:!!o.heldBy,position:{...o.position}};},handle);

// SET_OBJECT_AS_STEALABLE (GUNS1's crates): on foot the enter/exit button lifts a stealable object in front of CJ and
// he carries it (IS_CHAR_HOLDING_OBJECT); the button again sets it down before him (AUTHORED: FindObjectToSteal is
// unreversed).
test('CJ picks up a stealable crate with the enter/exit button and sets it down again',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 // GUNS1's DB_AMMO a unit in front of CJ, on the ground, stealable.
 const handle=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position,h=g.sim.player.heading;
  const x=p.x+Math.sin(h)*1.1,z=p.z+Math.cos(h)*1.1,ground=g.groundAt(x,z,p.y+2)??p.y;
  const o=m.runtime.game.objects.create('DB_AMMO',{x,y:-z,z:ground},{missionCleanup:false});m.adapterRef.setObjectAsStealable(o.handle,true);return o.handle;});
 // Drawn: its model and collision are in.
 await expect.poll(()=>page.evaluate(h=>!!(window as any).__game.scriptObjectViews()?.groupFor(h),handle),{timeout:60000}).toBe(true);
 const before=await crate(page,handle);expect(before.held).toBe(false);
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await crate(page,handle)).held,{timeout:10000}).toBe(true);
 // Carried before his chest, above where it lay.
 await page.waitForTimeout(800);
 const carried=await crate(page,handle);expect(carried.position.z).toBeGreaterThan(before.position.z+.5);
 expect((await state(page)).carEntry.phase??null).toBeNull();
 await page.evaluate(()=>{const g=(window as any).__game;g.render().yaw=g.sim.player.heading+Math.PI*.6;});await page.waitForTimeout(600);
 await page.screenshot({path:'artifacts/stealable-crate.png'});
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await crate(page,handle)).held,{timeout:10000}).toBe(false);
 const down=await crate(page,handle);expect(down.position.z).toBeLessThan(carried.position.z);
 expect(errors).toEqual([]);
});
