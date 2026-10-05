import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A dance reads the left stick while the script holds CJ: the touch controls put up the iOS port's rhythm arrows, a
 * diamond under the right thumb (its RHYTHM_UP, _DOWN, _LEFT and _RIGHT widgets), and Up pushes the stick full up. */
test.use({hasTouch:true});
test('a rhythm game gets the port’s four arrows, and Up is the stick pushed up',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.state())).player.grounded,{timeout:60000}).toBe(true);
 const arrows=['up','down','left','right'].map(d=>page.locator(`.touch-button.rhythm-${d}`));
 for(const a of arrows)await expect(a).toBeHidden();
 // As dance.scm does: SET_PLAYER_CONTROL off, then GET_POSITION_OF_ANALOGUE_STICKS every frame.
 await page.evaluate(()=>{const r=(window as any).__game.missionForProfiling().runtime;r.world.setPlayerControl(0,false);
  (window as any).__dance=setInterval(()=>{r.game.pads.state(0,0);r.game.pads.state(0,1);},30);});
 for(const a of arrows)await expect(a).toBeVisible({timeout:10000});
 // The pad's own buttons give way to them, as to a shop menu's.
 await expect(page.locator('.touch-buttons>.touch-button:not([class*=rhythm-]):visible')).toHaveCount(0);
 // A diamond: up above down, left and right either side, all on the right half.
 const [up,down,left,right]=await Promise.all(arrows.map(a=>a.boundingBox()));
 expect(up!.y).toBeLessThan(down!.y);expect(left!.x).toBeLessThan(up!.x);expect(right!.x).toBeGreaterThan(up!.x);
 expect(left!.x).toBeGreaterThan(page.viewportSize()!.width/2);
 const b=up!;await page.evaluate(({x,y})=>{document.querySelector('.touch-button.rhythm-up')!.dispatchEvent(new PointerEvent('pointerdown',{pointerId:4,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));},{x:b.x+b.width/2,y:b.y+b.height/2});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.pads.state(0,1)),{timeout:5000}).toBe(-128);
 await page.evaluate(({x,y})=>{document.querySelector('.touch-button.rhythm-up')!.dispatchEvent(new PointerEvent('pointerup',{pointerId:4,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));},{x:b.x+b.width/2,y:b.y+b.height/2});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.pads.state(0,1)),{timeout:5000}).toBe(0);
 // The dance over (the script lets go and stops reading), they go.
 await page.evaluate(()=>{clearInterval((window as any).__dance);(window as any).__game.missionForProfiling().runtime.world.setPlayerControl(0,true);});
 for(const a of arrows)await expect(a).toBeHidden({timeout:10000});
 expect(errors).toEqual([]);
});
