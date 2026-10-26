import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('native Greenwood rear lamp textures follow night lighting and driven pedal brakes',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game;return g?.state().player.grounded&&g.fleet()?.cars.size>0;},undefined,{timeout:60000});
 const rows=await page.evaluate(()=>{
  const g=(window as any).__game,car=[...g.fleet().cars].find((c:any)=>c.modelId===492);if(!car)throw Error('No Greenwood');
  const bindings=car.car.materialBindings().filter((b:any)=>b.texture===car.assets.lightTexture),rear=bindings.filter((b:any)=>[[185,255,0],[255,60,0]].some(rgb=>rgb.every((v,i)=>b.source.color[i]===v)));
  if(!rear.length)throw Error('No native rear lamp bindings');
  const old={occupied:car.occupied,autopilot:car.autopilot,driverOut:car.driverOut,lightsOn:car.lightsOn,pedals:{...car.input.pedals},broken:[...car.damageState.lights]},rows:any[]=[];
  try{
   car.lightsOn=false;car.input.pedals.brake=0;car.setLighting(undefined,undefined,1,0);const off=rear.map((b:any)=>b.material.map);
   for(const mode of ['day','pedal','handbrake','night','night handbrake','broken rear','restored']){
    car.occupied=!['day','restored'].includes(mode);car.autopilot=undefined;car.driverOut=false;car.lightsOn=mode.startsWith('night')||mode==='broken rear';car.input.pedals.brake=['pedal','handbrake','night handbrake'].includes(mode)?1:0;car.input.pedals.handbrake=mode.includes('handbrake');car.damageState.lights.fill(mode==='broken rear');
    car.setLighting(undefined,undefined,1,car.lightsOn?1:0);
    rows.push({mode,materials:rear.length,lit:rear.map((b:any,i:number)=>b.material.map!==off[i]),ambient:rear.map((b:any)=>b.material.userData.nativeSurface?.ambient.value),diffuse:rear.map((b:any)=>b.material.userData.nativeSurface?.diffuse.value)});
   }
  }finally{Object.assign(car,{occupied:old.occupied,autopilot:old.autopilot,driverOut:old.driverOut,lightsOn:old.lightsOn});Object.assign(car.input.pedals,old.pedals);car.damageState.lights.splice(0,4,...old.broken);car.setLighting(undefined,undefined,1,0);}
  return rows;
 });
 writeFileSync('artifacts/car-lamp-activation.json',JSON.stringify({rows,errors},null,2));
 for(const row of rows){const lit=['pedal','night','night handbrake'].includes(row.mode);expect(row.lit).toEqual(Array(row.materials).fill(lit));if(lit){expect(row.ambient).toEqual(Array(row.materials).fill(5));expect(row.diffuse).toEqual(Array(row.materials).fill(1));}}
 expect(errors).toEqual([]);
});
