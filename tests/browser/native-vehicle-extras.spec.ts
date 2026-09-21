import {test,expect} from '@playwright/test';

// CVehicleModelInfo::CreateInstance: a model's extra1..extra6 atomics are held back and at most two come back per
// vehicle. The Sadler carries four, so without the rules every one of them would render at once.
test('a vehicle shows at most two of its extra components',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 // Sadler (543) has four extras, Walton (478) three, Bobcat (422) two.
 const counts:Record<number,{extras:number;shown:number}>[]=[];
 for(const model of [543,478,422]){
  await page.evaluate(m=>(window as any).__game.spawnVehicle(m),model);
  await expect.poll(async()=>(await state()).fleet.cars.some((c:any)=>c.modelId===model),{timeout:30000}).toBe(true);
  await page.waitForTimeout(400);
  const seen=await page.evaluate(m=>{const g=(window as any).__game;const car=[...g.fleet().cars].find((c:any)=>c.assets.vehicle.id===m);if(!car)return null;
   const frames=car.assets.model.frames as any[];
   const extras=frames.map((f:any,i:number)=>({i,name:String(f.name).trim().toLowerCase()})).filter((f:any)=>/^extra[1-6]$/.test(f.name));
   let shown=0;car.car.root.traverse((o:any)=>{if(!o.isMesh||!o.visible)return;
    let node=o.parent,frame=-1;while(node){if(node.userData?.nativeFrame!==undefined){frame=node.userData.nativeFrame;break;}node=node.parent;}
    if(extras.some((e:any)=>e.i===frame))shown++;});
   return {extras:extras.length,shown};},model);
  expect(seen,`model ${model}`).not.toBeNull();
  counts.push({[model]:seen!});
  expect(seen!.extras,`model ${model} has extras`).toBeGreaterThan(0);
  expect(seen!.shown,`model ${model} shows ${seen!.shown} of ${seen!.extras}`).toBeLessThanOrEqual(2);
 }
 // The Sadler's four extras must not all render.
 const sadler=counts[0][543];expect(sadler.extras).toBe(4);expect(sadler.shown).toBeLessThan(4);
 await page.screenshot({path:'artifacts/native-vehicle-extras.png'});
 expect(errors).toEqual([]);
 console.log(JSON.stringify(counts));
});
