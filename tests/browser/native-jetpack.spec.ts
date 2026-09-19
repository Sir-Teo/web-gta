import {test,expect} from '@playwright/test';
// CCheat::JetpackCheat gives the player CTaskSimpleJetPack: ROCKETMAN, then the forward key flies him off Grove Street.
test('the jetpack cheat flies the player',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 expect((await state()).jetPack).toBeNull();
 // The cheat string carries an M, which this port's map overlay also answers; close it again.
 await page.keyboard.type('ROCKETMAN',{delay:30});await page.keyboard.press('KeyM');
 await expect.poll(async()=>(await state()).jetPack!==null,{timeout:10000}).toBe(true);
 // Coasting, the nominal thrust is under gravity, so the pack lowers the player back to the ground.
 await page.waitForTimeout(1500);
 expect((await state()).player.grounded).toBe(true);
 expect((await state()).jetPack.thrustFwd).toBe(0);
 const start={...(await state()).player.position};
 // At the full 75° lean the lift only carries the flier, so height is won on the way into the lean: pulsing the
 // forward key climbs while the flight runs on.
 let flying:Awaited<ReturnType<typeof state>>|undefined;
 for(let i=0;i<16;i++){
  await page.keyboard.down('KeyW');await page.waitForTimeout(350);
  if(i>=3&&!flying)flying=await state();
  await page.keyboard.up('KeyW');await page.waitForTimeout(250);
  const now=await state();
  if(now.player.position.y-start.y>2.5&&Math.hypot(now.player.position.x-start.x,now.player.position.z-start.z)>20)break;
 }
 // Under power the thrust leans forward (the pad's forward axis is negative) and the flame is full.
 expect(flying!.player.grounded).toBe(false);
 expect(flying!.jetPack.thrustFwd).toBe(1);
 expect(flying!.jetPack.angle).toBeLessThan(-.2);
 expect(flying!.jetPack.fx).toBe(1);
 // The legs hang and swing under him.
 expect(Math.abs(flying!.jetPack.legs[0])).toBeGreaterThan(0);
 // The pack model rides the player's back with a `jetpack` flame on each thruster.
 expect(flying!.jetPack.error).toBeNull();
 expect(flying!.jetPack.worn).toBe(true);
 expect(flying!.jetPack.flames).toBe(2);
 expect(flying!.fx.active).toContain('jetpack');
 const flown=await state();
 expect(flown.player.position.y-start.y).toBeGreaterThan(2);
 expect(Math.hypot(flown.player.position.x-start.x,flown.player.position.z-start.z)).toBeGreaterThan(20);
 await page.screenshot({path:'artifacts/native-jetpack.png'});
 // Braking halves the lift and brings him down.
 await page.keyboard.down('KeyS');
 await expect.poll(async()=>(await state()).jetPack.thrustFwd,{timeout:5000}).toBe(-1);
 await expect.poll(async()=>(await state()).player.grounded,{timeout:40000}).toBe(true);
 await page.keyboard.up('KeyS');
 // Standing still, the exit-vehicle key drops the pack and the player walks again.
 await page.waitForTimeout(500);
 await page.keyboard.down('KeyF');await page.waitForTimeout(600);await page.keyboard.up('KeyF');
 await expect.poll(async()=>(await state()).jetPack,{timeout:10000}).toBeNull();
 // Dropping it takes the model and its flames away, once the last particles have burnt out.
 await expect.poll(async()=>(await state()).fx.active.includes('jetpack'),{timeout:10000}).toBe(false);
 // The dropped pack is left as a pickup, which hands it back when he walks into it.
 const spawned=(await state()).pickups.spawned;
 expect(spawned).toBeGreaterThan(0);
 await page.keyboard.down('KeyW');await page.waitForTimeout(700);await page.keyboard.up('KeyW');
 await page.keyboard.down('KeyS');
 await expect.poll(async()=>(await state()).jetPack!==null,{timeout:15000}).toBe(true);
 await page.keyboard.up('KeyS');
 expect(errors).toEqual([]);
});
