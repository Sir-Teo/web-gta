import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CTaskSimplePlayerOnFoot::PlayerControlDucked: a jump press, sprint or an exit-vehicle press stands a crouched CJ up;
// the jump press does not also jump.
test('jump, sprint and the exit button stand a crouched CJ up',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('KeyC');await expect.poll(async()=>(await state()).player.crouched).toBe(true);
 const y=(await state()).player.position.y;
 await page.keyboard.press('Space');
 await expect.poll(async()=>(await state()).player.crouched).toBe(false);
 // Standing up, not jumping.
 for(let i=0;i<6;i++){await page.waitForTimeout(80);expect((await state()).player.position.y).toBeLessThan(y+.5);}
 await page.keyboard.press('KeyC');await expect.poll(async()=>(await state()).player.crouched).toBe(true);
 await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
 await expect.poll(async()=>(await state()).player.crouched).toBe(false);
 await expect.poll(async()=>(await state()).player.speed).toBeGreaterThan(4);
 await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
 // ExitVehicleJustDown stands him up too; away from any car it does nothing else.
 await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;g.placePlayer(p.x+40,g.groundAt(p.x+40,p.z,p.y+20)+.05,p.z);});
 await expect.poll(async()=>(await state()).player.grounded,{timeout:30000}).toBe(true);
 await expect.poll(async()=>(await state()).player.speed).toBeLessThan(.1);
 await page.keyboard.press('KeyC');await expect.poll(async()=>(await state()).player.crouched).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).player.crouched).toBe(false);
 expect((await state()).carEntry.phase).toBeNull();
 expect(errors).toEqual([]);
});

// CTaskSimpleDuck under PlayerControlDucked with a gun aimed: a sideways push rolls (CROUCH_ROLL_R, about 2.8 units
// right) with the gun held, and the stick walks forward and back on GUNCROUCHFWD/BWD without turning CJ.
test('a crouched CJ aiming a pistol rolls sideways and steps back',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placePlayer(2480,12.6,1668));await page.waitForTimeout(300);
 await page.keyboard.press('Tab');await page.locator('[data-weapon="22"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 await page.keyboard.press('KeyC');await expect.poll(async()=>(await state()).player.crouched).toBe(true);
 await page.mouse.move(720,450);await page.mouse.down({button:'right'});await page.waitForTimeout(500);
 const before=await state(),h=before.player.heading,forward={x:Math.sin(h),z:Math.cos(h)};
 await page.keyboard.down('KeyD');await expect.poll(async()=>(await state()).duck.rolling).toBe(true);await page.keyboard.up('KeyD');
 await expect.poll(async()=>(await state()).duck.rolling,{timeout:5000}).toBe(false);
 const rolled=await state(),d={x:rolled.player.position.x-before.player.position.x,z:rolled.player.position.z-before.player.position.z};
 expect(Math.hypot(d.x,d.z)).toBeGreaterThan(2.2);expect(Math.hypot(d.x,d.z)).toBeLessThan(3.3);
 expect(Math.abs(d.x*forward.x+d.z*forward.z)).toBeLessThan(.6);
 // CJ's right in the renderer frame is (−cos h, sin h).
 expect(d.x*-Math.cos(h)+d.z*Math.sin(h)).toBeGreaterThan(2.2);
 expect(rolled.player.crouched).toBe(true);
 // Back on the stick: GUNCROUCHBWD carries CJ behind him while he keeps facing the aim.
 await page.keyboard.down('KeyS');await page.waitForTimeout(1200);await page.keyboard.up('KeyS');await page.waitForTimeout(300);
 const back=await state(),b={x:back.player.position.x-rolled.player.position.x,z:back.player.position.z-rolled.player.position.z};
 expect(b.x*forward.x+b.z*forward.z).toBeLessThan(-.5);
 // Headings wrap: 0 and 2π face the same way.
 expect(Math.abs(Math.atan2(Math.sin(back.player.heading-h),Math.cos(back.player.heading-h)))).toBeLessThan(.2);
 await page.mouse.up({button:'right'});
 expect(errors).toEqual([]);
});
