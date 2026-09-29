import {test,expect} from '@playwright/test';

test('the boat\'s driver sits in DRIVE_BOAT, and a standing boat\'s steers with DRIVE_BOAT_L and _R',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet?.()),{timeout:60000}).toBe(true);
 // Open water off the Los Santos docks (native 2600, -2600).
 const boarded=await page.evaluate(async()=>{
  const g=(window as any).__game,fleet=g.fleet();
  g.placePlayer(2600,3,2600);
  const boat=await fleet.spawnBoat(453,2600,2601,0);
  for(let i=0;i<40&&!boat.seat();i++)await new Promise(r=>setTimeout(r,100));
  // Seated directly: boarding itself needs CJ aboard or touching the hull (CTaskComplexEnterBoatAsDriver).
  boat.finishEnter();
  return {occupied:boat.occupied,sit:!!(boat.modelFlags&0x400),seat:boat.seat()};
 });
 expect(boarded.occupied,JSON.stringify(boarded)).toBe(true);
 await expect.poll(async()=>(await state()).nativeCharacter?.vehicleClip,{timeout:20000}).toBe('drive_boat');
 // Steering: the Reefer has no sit-in-boat flag, so the boat set's steering clip plays over the idle.
 expect(boarded.sit).toBe(false);
 // The docks stream in first (the load hold stops the simulation until they have).
 await page.keyboard.down('KeyA');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.fleet().occupiedBoat.driving.overlays().length),{timeout:60000}).toBeGreaterThan(0);
 const steering=await page.evaluate(()=>(window as any).__game.fleet().occupiedBoat.driving.overlays().map((o:any)=>o.clip));
 await page.keyboard.up('KeyA');
 expect(steering).toEqual([expect.stringMatching(/^drive_boat_[lr]$/)]);
 // Drawn, and at the seat inside the hull.
 const placed=await page.evaluate(()=>{const g=(window as any).__game,c=g.render().nativeCharacter.root,b=g.fleet().occupiedBoat.root;
  const cp=c.getWorldPosition(c.position.clone()),bp=b.getWorldPosition(b.position.clone());return {visible:c.visible,distance:cp.distanceTo(bp)};});
 expect(placed.visible).toBe(true);expect(placed.distance).toBeLessThan(4);
 await page.screenshot({path:'artifacts/boat-driver-pose.png'});
 expect(errors).toEqual([]);
});
