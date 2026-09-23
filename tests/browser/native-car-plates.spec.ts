import {test,expect} from '@playwright/test';

// CCustomCarPlateMgr: every car model carries a generated eight-character plate drawn from the platecharset cells,
// with the plateback of the spawn region (Los Santos is design 2).
test('cars carry a generated number plate with the region plateback',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 // The bundled starter Greenwood loads outside the catalog and carries no plate: wait for a traffic car.
 await expect.poll(async()=>(await state()).fleet?.cars.filter((c:any)=>c.plate).length??0,{timeout:90000}).toBeGreaterThan(0);
 const plates=(await state()).fleet.cars.map((c:any)=>c.plate).filter(Boolean);
 for(const plate of plates){
  // Two letters, two digits, a space, a digit and two letters (GeneratePlateText).
  expect(plate.text).toMatch(/^[A-W][A-W][0-8][0-8] [0-8][A-W][A-W]$/);
  // Grove Street is the LA weather region: plateback3.
  expect(plate.design).toBe(2);
 }
 // The plate material carries the generated 64 x 16 raster, not the model's 16 x 16 placeholder.
 // The starter Greenwood is bundled separately and carries no catalog plate: probe a car that has one.
 const texture=await page.evaluate(()=>{const g=(window as any).__game;const car=[...g.fleet().cars].find((c:any)=>c.assets.plate);if(!car)return null;let found:any=null;
  car.car.root.traverse((o:any)=>{if(!o.isMesh)return;for(const m of [o.material].flat()){const map=m.map;if(map&&map.name?.toLowerCase()==='carplate'&&!found)found={name:map.name,width:map.image?.width,height:map.image?.height};}});
  return found;});
 expect(texture,'carplate material texture').not.toBeNull();
 expect(texture.width).toBe(64);expect(texture.height).toBe(16);
 // Park a plated car in front of CJ and look at its back: the plate reads its generated text.
 const parked=await page.evaluate(()=>{const g=(window as any).__game,car=[...g.fleet().cars].find((c:any)=>c.assets.plate);if(!car)return null;
  const p=g.state().player.position;g.placeFleetCar('handle:'+car.car.body.handle,p.x,p.y+.6,p.z-5,0);return {text:car.assets.plate.text,x:p.x,y:p.y,z:p.z};});
 expect(parked).not.toBeNull();
 await page.waitForTimeout(600);
 // Stand to the side of the boot so the follow camera sees the plate past CJ.
 await page.evaluate(({x,y,z}:any)=>{const g=(window as any).__game;g.placePlayer(x-1.8,y,z-1.6);g.turnPlayer(Math.PI-.6);},parked);
 await page.waitForTimeout(1200);
 await page.screenshot({path:'artifacts/native-car-plates.png'});
 expect(errors).toEqual([]);
});
