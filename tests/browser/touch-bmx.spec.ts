import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** On a bicycle the touch controls' fire button is the port's bunny hop (CBmx::ProcessBunnyHop reads the car's weapon
 * button): a jump glyph at the fire button's place; held it charges, let go the BMX hops. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('a phone bunny-hops a BMX with the Bunny hop button where Fire stands',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const bmx=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;return m.vehicles.create(481,{x:p.x+3,y:-p.z,z:-100},0) as number;});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),bmx,{timeout:60000});await page.waitForTimeout(1500);
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,h),bmx);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.fleet()?.occupiedBike?.modelId??null),{timeout:20000}).toBe(481);
 const hop=page.getByRole('button',{name:'Bunny hop',exact:true});
 await expect(hop).toBeVisible();await expect(page.getByRole('button',{name:'Fire',exact:true})).toBeHidden();
 const press=async(type:string)=>page.evaluate(type=>{const b=document.querySelector('.touch-button.hop')!,r=b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent(type,{pointerId:31,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true,cancelable:true}));},type);
 const bike=()=>page.evaluate(()=>{const b=(window as any).__game.fleet().occupiedBike;return {charge:b.controlJump as number,vy:b.body.linvel().y as number};});
 await page.waitForTimeout(1000);
 // Held, the hop charges; let go, the bike leaves the ground.
 await press('pointerdown');await expect.poll(async()=>(await bike()).charge,{timeout:5000}).toBeGreaterThan(5);
 await press('pointerup');await expect.poll(async()=>(await bike()).vy,{timeout:5000,intervals:[20]}).toBeGreaterThan(1);
 expect(errors).toEqual([]);
});
