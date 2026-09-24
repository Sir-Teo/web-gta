import {test,expect} from '@playwright/test';

// CVehicleModelInfo::ChooseVehicleColour: a model's vehicles walk its carcols line instead of all sharing one paint.
test('cars of one model take different carcols variations',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 // The fleet comes up after the player lands; the spawns and samples need it.
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet()),{timeout:60000}).toBe(true);
 // Four Sadlers in turn: each cheat spawn replaces the last, so the paint is read as each arrives.
 const paints:any[]=[];
 const sample=()=>page.evaluate(()=>{const car=[...(window as any).__game.fleet().cars].find((c:any)=>c.assets.vehicle.id===543);
  return car?{variation:car.assets.colourVariation,indices:car.assets.colourIndices,primary:car.assets.colors[0]}:null;});
 for(let i=0;i<4;i++){
  await page.evaluate(()=>(window as any).__game.spawnVehicle(543));
  // Under load a spawn can take a while: wait for a car whose paint is not the one already recorded.
  const previous=paints.length?JSON.stringify(paints[paints.length-1]):null;
  let paint=null;
  for(let wait=0;wait<40;wait++){paint=await sample();if(paint&&JSON.stringify(paint)!==previous)break;await page.waitForTimeout(250);}
  if(paint&&JSON.stringify(paint)!==previous)paints.push(paint);
 }
 expect(paints.length,JSON.stringify(paints)).toBeGreaterThanOrEqual(3);
 const variations=paints.map((p:any)=>p.variation);
 expect(new Set(variations).size,JSON.stringify(paints)).toBeGreaterThan(1);
 // Consecutive spawns step the counter, so no two in a row repeat.
 for(let i=1;i<variations.length;i++)expect(variations[i],JSON.stringify(variations)).not.toBe(variations[i-1]);
 // The paint really follows the variation: the primary colour differs somewhere.
 expect(new Set(paints.map((p:any)=>JSON.stringify(p.primary))).size).toBeGreaterThan(1);
 await page.screenshot({path:'artifacts/native-vehicle-colours.png'});
 expect(errors).toEqual([]);
 console.log(JSON.stringify(paints));
});
