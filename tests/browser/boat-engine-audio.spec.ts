import {test,expect} from '@playwright/test';
// CAEVehicleAudioEntity's AE_BOAT case: ProcessBoatEngine loops BOAT_INBOARD_D (rebuilt from the iOS bundle) pitched
// by CBoat's propeller speed, and ProcessBoatMovingOverWater skims the hull over the water. Before, boats were silent.
test('a boat has an engine that rises with the throttle, and skims the water',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet?.()),{timeout:60000}).toBe(true);
 // Open water off the Los Santos docks (native 2600, -2600), in a Speeder.
 await page.evaluate(async()=>{
  const g=(window as any).__game,fleet=g.fleet();
  g.placePlayer(2600,3,2600);
  const boat=await fleet.spawnBoat(452,2600,2601,0);
  for(let i=0;i<40&&!boat.seat();i++)await new Promise(r=>setTimeout(r,100));
  boat.finishEnter();
 });
 const entity=()=>page.evaluate(()=>{const a=(window as any).__game.state().audio.native;return {boat:a.vehicles.find((v:any)=>v.model===452),banks:a.banks.slots,slots:a.slots};});
 // The dummy bank in its slot and the engine loop (sound type 2) playing.
 await expect.poll(async()=>{const e=await entity();return !!e.boat&&e.banks.some(([slot,bank]:number[])=>slot===e.boat.dummySlot&&bank===21);},{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await entity()).boat?.sounds.includes(2),{timeout:30000}).toBe(true);
 const idle=await page.evaluate(()=>(window as any).__game.fleet().occupiedBoat.engineSpeed);
 await page.keyboard.down('KeyW');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.fleet().occupiedBoat.engineSpeed),{timeout:30000}).toBeGreaterThan(.25);
 // Under way, the hull's skim (sound type 6) joins it.
 await expect.poll(async()=>(await entity()).boat?.sounds.includes(6),{timeout:30000}).toBe(true);
 await page.keyboard.up('KeyW');
 expect(idle).toBeLessThan(.25);
 expect(errors).toEqual([]);
});
